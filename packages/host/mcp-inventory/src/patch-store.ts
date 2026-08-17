/**
 * Write-side store for the home-level user patch layer (`$DSH_HOME/cordis.patch.yml`).
 *
 * Every profile composes this layer over its own, and the web launcher watches
 * it for config-only HMR — a persisted edit here is picked up automatically and
 * the affected fibers restart with the new config. The file is a list of loader
 * patch operations, so a new MCP server must be written as an `insert:` row
 * (a bare `{id, name, config}` row is an id-targeted override of an existing
 * bundle entry and is rejected with "entry not found" by the loader). The store
 * flattens insert children for reading, and on write keeps every non-MCP row
 * the file already carries, only rewrapping the MCP rows (entry-level comments
 * are normalized away).
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

/** Module specifier of the MCP client bridge plugin (matches the gateway's predicate). */
const MCP_CLIENT_MODULE = '@deepseek-ai/dsh-mcp-client'

/** Whether one patch-row module name is an mcp-client instance (`cordis:` builtin form included). */
export function isMcpClientName(name: unknown): boolean {
  if (typeof name !== 'string') return false
  const normalized = name.startsWith('cordis:') ? name.slice(7) : name
  return normalized === MCP_CLIENT_MODULE || normalized.endsWith(`/${MCP_CLIENT_MODULE}`)
}

/** One flattened row of a cordis patch file (id always present; name/`config` when authored). */
export interface PatchEntry {
  readonly id: string
  readonly name: string
  readonly config?: unknown
}

/** Absolute path of the home-level user patch layer. */
export function homePatchPath(): string {
  return join(resolveDshHome(), HOME_PATCH_FILENAME)
}

/** Read the raw patch rows; a missing or empty file yields an empty list. */
function readPatchRows(): unknown[] {
  let raw: string
  try {
    raw = readFileSync(homePatchPath(), { encoding: 'utf8' })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw error
  }
  const parsed = parseDocument(raw).toJS() as unknown
  if (parsed === null || parsed === undefined) return []
  if (!Array.isArray(parsed)) {
    throw new Error(`home patch file is not an entry list: ${homePatchPath()}`)
  }
  return parsed
}

/** Flatten one patch row (a plain row or an `insert:` list) into entries. */
function rowEntries(row: unknown): PatchEntry[] {
  if (typeof row !== 'object' || row === null) return []
  const record = row as Record<string, unknown>
  const candidates = Array.isArray(record.insert) ? record.insert : [row]
  const out: PatchEntry[] = []
  for (const candidate of candidates) {
    if (typeof candidate !== 'object' || candidate === null) continue
    const item = candidate as Record<string, unknown>
    if (typeof item.id !== 'string') continue
    out.push({
      id: item.id,
      name: typeof item.name === 'string' ? item.name : '',
      ...item.config === undefined ? {} : { config: item.config },
    })
  }
  return out
}

/** Read the home patch entries; a missing or empty file yields an empty list. */
export function readHomePatchEntries(): PatchEntry[] {
  return readPatchRows().flatMap(rowEntries)
}

/** Split the parsed rows into preserved non-MCP rows and flattened MCP entries. */
function splitMcpRows(rows: unknown[]): { foreign: unknown[]; mcp: PatchEntry[] } {
  const foreign: unknown[] = []
  const mcp: PatchEntry[] = []
  for (const row of rows) {
    if (typeof row !== 'object' || row === null) {
      foreign.push(row)
      continue
    }
    const record = row as Record<string, unknown>
    if (Array.isArray(record.insert)) {
      const kept: unknown[] = []
      for (const child of record.insert) {
        if (isMcpClientName((child as Record<string, unknown> | null)?.name)) {
          mcp.push(...rowEntries(child))
        } else {
          kept.push(child)
        }
      }
      // An insert row that kept no children is a no-op; drop it (unless it
      // targets a group, which keeps the row so the empty insert stays honest).
      if (kept.length > 0 || record.id !== undefined) foreign.push({ ...record, insert: kept })
    } else if (isMcpClientName(record.name)) {
      mcp.push(...rowEntries(row))
    } else {
      foreign.push(row)
    }
  }
  return { foreign, mcp }
}

/** Persist the given MCP entries to the home patch layer (atomic replace). */
export function writeHomePatchEntries(entries: readonly PatchEntry[]): void {
  const path = homePatchPath()
  const { foreign } = splitMcpRows(readPatchRows())
  const rows = [
    ...foreign,
    ...entries.map(entry => ({
      insert: [{
        id: entry.id,
        name: entry.name,
        ...entry.config === undefined ? {} : { config: entry.config },
      }],
    })),
  ]
  const body = `${HOME_PATCH_HEADER}${stringify(rows, { indent: 2 })}`
  mkdirSync(dirname(path), { recursive: true })
  const temporary = `${path}.tmp`
  writeFileSync(temporary, body, { encoding: 'utf8' })
  renameSync(temporary, path)
}
