/**
 * Write-side store for the home-level user patch layer (`$DSH_HOME/cordis.patch.yml`).
 *
 * Every profile composes this layer over its own, and the web launcher watches
 * it for config-only HMR — a persisted edit here is picked up automatically and
 * the affected fibers restart with the new config. The store keeps every entry
 * the file already carries and only rewrites the serialized document, so other
 * plugins' rows survive an MCP edit (entry-level comments are normalized away).
 *
 * @module @deepseek-ai/dsh-host-mcp-inventory/patch-store
 */

import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { parseDocument, stringify } from 'yaml'
import { resolveDshHome } from '@deepseek-ai/dsh-home-paths'

/** Filename of the home-level user patch layer every profile composes over. */
export const HOME_PATCH_FILENAME = 'cordis.patch.yml'

/** Banner kept at the top of a freshly created home patch file. */
const HOME_PATCH_HEADER = `# dsh home-level user patch layer — merged over every profile's own layer.
# Managed by the MCP settings section; edits here stay live via config HMR.
`

/** One row of a cordis patch file. */
export interface PatchEntry {
  readonly id: string
  readonly name: string
  readonly config?: unknown
}

/** Absolute path of the home-level user patch layer. */
export function homePatchPath(): string {
  return join(resolveDshHome(), HOME_PATCH_FILENAME)
}

/** Read the home patch entries; a missing or empty file yields an empty list. */
export function readHomePatchEntries(): PatchEntry[] {
  let raw: string
  try {
    raw = readFileSync(homePatchPath(), { encoding: 'utf8' })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw error
  }
  const doc = parseDocument(raw)
  const parsed = doc.toJS() as unknown
  if (parsed === null || parsed === undefined) return []
  if (!Array.isArray(parsed)) {
    throw new Error(`home patch file is not an entry list: ${homePatchPath()}`)
  }
  return parsed.flatMap((row) => {
    if (typeof row !== 'object' || row === null) return []
    const record = row as Record<string, unknown>
    if (typeof record.id !== 'string' || typeof record.name !== 'string') return []
    return [{
      id: record.id,
      name: record.name,
      ...record.config === undefined ? {} : { config: record.config },
    }]
  })
}

/** Persist the given entry list back to the home patch layer (atomic replace). */
export function writeHomePatchEntries(entries: readonly PatchEntry[]): void {
  const path = homePatchPath()
  const body = `${HOME_PATCH_HEADER}${stringify(entries.map(entry => entry.config === undefined
    ? { id: entry.id, name: entry.name }
    : { id: entry.id, name: entry.name, config: entry.config }), { indent: 2 })}`
  mkdirSync(dirname(path), { recursive: true })
  const temporary = `${path}.tmp`
  writeFileSync(temporary, body, { encoding: 'utf8' })
  renameSync(temporary, path)
}
