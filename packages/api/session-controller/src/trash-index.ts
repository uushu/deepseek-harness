/**
 * Durable recoverable-delete index: a validated JSON document with serialized
 * local mutations and atomic replacement. Session-specific metadata belongs in
 * `session-trash.ts`; this class owns only the file lifecycle and retention
 * sweep.
 * @module @deepseek-ai/dsh-api-session-controller/trash-index
 */

import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'

/** Every recoverable-delete row carries the moment retention starts. */
export interface TrashIndexEntry {
  /** Unix epoch milliseconds when the entry became recoverable-delete state. */
  readonly deletedAt: number
}

/** Parse one durable index row at the file boundary. */
export type TrashIndexEntryParser<T extends TrashIndexEntry> = (value: unknown) => T

/** Outcome of one retention sweep. Failed irreversible operations retain their rows. */
export interface TrashSweepResult<T extends TrashIndexEntry> {
  /** Rows whose irreversible purge finished. */
  readonly purged: number
  /** Rows retained because their irreversible purge rejected. */
  readonly failures: readonly { readonly entry: T; readonly error: unknown }[]
}

function isENOENT(error: unknown): boolean {
  return (error as NodeJS.ErrnoException | null)?.code === 'ENOENT'
}

function indexFailure(path: string, reason: string): Error {
  return new Error(`recoverable-delete index "${path}" is invalid: ${reason}`)
}

/**
 * One root-owned recoverable-delete index. The in-process mutation queue keeps
 * a Host's trash/restore/purge operations from losing a read-modify-write
 * update; a durable write uses a unique sibling temporary followed by rename.
 */
export class TrashIndex<T extends TrashIndexEntry> {
  private readonly root: string
  private cached: readonly T[] | undefined
  private cachedAt = 0
  private mutationChain: Promise<void> = Promise.resolve()

  /**
   * @param root - directory containing the index document.
   * @param retentionMs - how long rows remain recoverable.
   * @param parseEntry - durable-file parser for one domain row.
   */
  constructor(
    root: string,
    private readonly retentionMs: number,
    private readonly parseEntry: TrashIndexEntryParser<T>,
  ) {
    this.root = resolve(root)
  }

  /** Read every recoverable row. Callers receive a detached array. */
  async list(): Promise<readonly T[]> {
    return [...await this.readEntries()]
  }

  /**
   * Serialize one read-modify-write mutation. A failing mutation releases the
   * next operation but does not replace the last valid cache.
   * @param update - function producing the full next durable row list.
   */
  protected async mutate(update: (entries: readonly T[]) => readonly T[] | Promise<readonly T[]>): Promise<void> {
    const previous = this.mutationChain
    let release: () => void = () => {}
    this.mutationChain = new Promise<void>((resolveMutation) => { release = resolveMutation })
    await previous
    try {
      const next = [...await update(await this.readEntries())]
      await this.writeEntries(next)
      this.cached = next
      this.cachedAt = Date.now()
    } finally {
      release()
    }
  }

  /**
   * Purge rows at or beyond their retention window. A failed purge deliberately
   * keeps its row so the next sweep can retry rather than forgetting data whose
   * session artifact still exists.
   * @param now - retention anchor in epoch milliseconds.
   * @param purge - irreversible action for one expired entry.
   * @returns successfully purged and retained-failure rows.
   */
  async sweep(now: number, purge: (entry: T) => Promise<void>): Promise<TrashSweepResult<T>> {
    let purged = 0
    const failures: Array<{ readonly entry: T; readonly error: unknown }> = []
    await this.mutate(async (entries) => {
      const kept: T[] = []
      for (const entry of entries) {
        if (now - entry.deletedAt < this.retentionMs) {
          kept.push(entry)
          continue
        }
        try {
          await purge(entry)
          purged += 1
        } catch (error: unknown) {
          kept.push(entry)
          failures.push({ entry, error })
        }
      }
      return kept
    })
    return { purged, failures }
  }

  private file(): string {
    return join(this.root, 'index.json')
  }

  private async readEntries(): Promise<readonly T[]> {
    const now = Date.now()
    if (this.cached !== undefined && now - this.cachedAt < 1000) return this.cached
    const path = this.file()
    let raw: string
    try {
      raw = await readFile(path, 'utf8')
    } catch (error: unknown) {
      if (!isENOENT(error)) throw error
      this.cached = []
      this.cachedAt = now
      return this.cached
    }
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      throw indexFailure(path, 'it is not valid JSON')
    }
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw indexFailure(path, 'the document is not an object')
    }
    const record = parsed as { readonly version?: unknown; readonly entries?: unknown }
    if (record.version !== 1) throw indexFailure(path, 'unsupported version')
    if (!Array.isArray(record.entries)) throw indexFailure(path, 'entries is not an array')
    try {
      this.cached = record.entries.map(entry => this.parseEntry(entry))
    } catch (error: unknown) {
      throw indexFailure(path, error instanceof Error ? error.message : String(error))
    }
    this.cachedAt = now
    return this.cached
  }

  private async writeEntries(entries: readonly T[]): Promise<void> {
    const path = this.file()
    await mkdir(dirname(path), { recursive: true, mode: 0o700 })
    const temporary = `${path}.${randomUUID()}.tmp`
    try {
      await writeFile(temporary, JSON.stringify({ version: 1, entries }), { encoding: 'utf8', mode: 0o600 })
      await rename(temporary, path)
    } catch (error: unknown) {
      try {
        await rm(temporary, { force: true })
      } catch {
        // The original write or rename failure identifies the mutation failure.
      }
      throw error
    }
  }
}
