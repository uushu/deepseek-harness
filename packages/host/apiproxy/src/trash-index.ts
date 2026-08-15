/**
 * Generic recoverable-delete index: one JSON file per root, an in-memory
 * cache with a short TTL, and a serialized mutation queue so concurrent
 * trash/restore/purge calls cannot interleave read-modify-write cycles.
 * Shared by the session trash and the workspace trash — the two domains
 * differ only in entry shape and retention window.
 * @module @deepseek-ai/dsh-host-apiproxy/trash-index
 */

import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

/** How long the in-memory index cache may serve before rereading the file. */
const CACHE_TTL_MS = 1000

/**
 * The recoverable-delete index. Entries older than the configured retention
 * window are swept automatically — the sweep runs before every trash listing
 * and on host start, so expired entries are purged even when no client ever
 * opens the trash page.
 */
export class TrashIndex<T> {
  private cached: { entries: T[] } | undefined
  private cachedAt = 0
  private mutationChain: Promise<void> = Promise.resolve()

  /**
   * @param root - directory that will hold `index.json` (created on demand).
   * @param retentionMs - how long an entry stays recoverable.
   */
  constructor(
    private readonly root: string,
    private readonly retentionMs: number,
  ) {}

  /** The index file for this root. */
  private file(): string {
    return join(this.root, 'index.json')
  }

  /**
   * Read the index, serving the memory cache within its TTL. An absent or
   * unreadable file reads as an empty index (never throws).
   * @returns the current entries.
   */
  async list(): Promise<T[]> {
    const now = Date.now()
    if (this.cached !== undefined && now - this.cachedAt < CACHE_TTL_MS) {
      return this.cached.entries
    }
    try {
      const raw = await readFile(this.file(), 'utf8')
      const parsed = JSON.parse(raw) as { entries?: unknown }
      this.cached = { entries: Array.isArray(parsed.entries) ? parsed.entries as T[] : [] }
    } catch {
      this.cached = { entries: [] }
    }
    this.cachedAt = now
    return this.cached.entries
  }

  /**
   * Serialized read-modify-write: mutations queue behind each other so
   * concurrent callers never lose a row, and the memory cache is invalidated
   * after every write.
   * @param update - derive the next entries from the current ones.
   */
  protected async mutate(
    update: (entries: T[]) => T[] | Promise<T[]>,
  ): Promise<void> {
    const run = async (): Promise<void> => {
      const entries = await this.list()
      const next = await update(entries)
      const file = this.file()
      await mkdir(dirname(file), { recursive: true })
      const payload = JSON.stringify({ version: 1, entries: next })
      // Atomic replace: write a sibling temp and rename over the target so a
      // crash mid-write can never leave a torn index behind.
      const temp = `${file}.tmp`
      await writeFile(temp, payload, 'utf8')
      await rename(temp, file)
      this.cached = { entries: next }
      this.cachedAt = Date.now()
    }
    const previous = this.mutationChain
    let release: () => void = () => {}
    this.mutationChain = new Promise<void>(resolve => { release = resolve })
    await previous
    try {
      await run()
    } finally {
      release()
    }
  }

  /**
   * Drop entries older than the retention window. The caller's `onPurge`
   * performs the irreversible work (removing the durable log / the folder);
   * a throwing `onPurge` keeps the row so the next sweep retries it.
   * @param now - the retention anchor (epoch milliseconds).
   * @param onPurge - per-entry irreversible purge; runs inside the mutation lock.
   * @returns how many entries were purged.
   */
  async sweep(
    now: number,
    onPurge: (entry: T) => Promise<void>,
  ): Promise<number> {
    let purged = 0
    await this.mutate(async entries => {
      const expired: T[] = []
      const kept: T[] = []
      for (const entry of entries) {
        if (now - (entry as { deletedAt: number }).deletedAt >= this.retentionMs) expired.push(entry)
        else kept.push(entry)
      }
      for (const entry of expired) {
        try {
          await onPurge(entry)
          purged += 1
        } catch {
          // A failed purge keeps the row for the next sweep.
          kept.push(entry)
        }
      }
      return kept
    })
    return purged
  }

  /** Remove the whole trash root (teardown utility, e.g. tests). */
  async clearAll(): Promise<void> {
    await rm(this.file(), { force: true })
    this.cached = undefined
    this.cachedAt = 0
  }
}
