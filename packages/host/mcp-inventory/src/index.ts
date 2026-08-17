/**
 * Projection and write side of the configured MCP servers: reads the Loader's
 * mcp-client entries for the read-only views, and persists user edits to the
 * home-level patch layer (`$DSH_HOME/cordis.patch.yml`) where the launcher's
 * config-only HMR picks them up and restarts the affected fibers.
 *
 * The write method is named `removeServer` (not `remove`) because the typert
 * Remote namespace service itself exposes `remove`, so `mcpInventory/remove`
 * would collide with it at client-remote mount time.
 */

import type { Context, FiberState } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/cordis-plugin-loader'
import { TypertRemoteService, Remote } from '@deepseek-ai/dsh-typert-protocol'
// Typert-generated ./typert and ./remote artifacts import Zod at runtime.
import type {} from 'zod'
import { validateServerConfig } from './config.ts'
import { readHomePatchEntries, writeHomePatchEntries, isMcpClientName } from './patch-store.ts'
import type {
  McpEntryId,
  McpFiberPhase,
  McpInventorySnapshot,
  McpRemoveResult,
  McpServerConfigInput,
  McpServerView,
} from './types.ts'

export type * from './types.ts'

/** Module specifier of the MCP client bridge plugin. */
const MCP_CLIENT_MODULE = '@deepseek-ai/dsh-mcp-client'

/** Brand an existing Loader-tree entry id at the owning boundary. */
function mcpEntryId(value: string): McpEntryId {
  return value as McpEntryId
}

/** Runtime mirror: FiberState is a cross-package const enum. */
const FIBER_STATE = {
  PENDING: 0 as FiberState.PENDING,
  LOADING: 1 as FiberState.LOADING,
  ACTIVE: 2 as FiberState.ACTIVE,
  FAILED: 3 as FiberState.FAILED,
  DISPOSED: 4 as FiberState.DISPOSED,
  UNLOADING: 5 as FiberState.UNLOADING,
} as const

/** Complete public projection of Cordis Fiber states. */
const FIBER_PHASE = {
  [FIBER_STATE.PENDING]: 'pending',
  [FIBER_STATE.LOADING]: 'loading',
  [FIBER_STATE.ACTIVE]: 'active',
  [FIBER_STATE.FAILED]: 'failed',
  [FIBER_STATE.DISPOSED]: null,
  [FIBER_STATE.UNLOADING]: 'unloading',
} as const satisfies Record<FiberState, McpFiberPhase>

/** Whether one Loader entry is an mcp-client instance (package specifier or `cordis:` builtin form). */
const isMcpClientEntry = isMcpClientName

/** Key NAMES of a string-keyed env/header map — values are secrets and never leave the host. */
function keyNames(values: unknown): readonly string[] | undefined {
  if (typeof values !== 'object' || values === null) return undefined
  const keys = Object.keys(values)
  return keys.length === 0 ? undefined : keys
}

/** Optional number field projected only when present. */
function optionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

/** Optional boolean field projected only when present. */
function optionalBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined
}

/** Project one mcp-client plugin config into the redacted server view body. */
function projectConfig(config: unknown): Pick<
  McpServerView,
  'serverName' | 'transport' | 'command' | 'args' | 'url' | 'cwd'
  | 'envKeys' | 'headerKeys' | 'toolCallTimeoutMs' | 'failOnStartupError' | 'reconnect'
> {
  if (typeof config !== 'object' || config === null) return {}
  const raw = config as Record<string, unknown>
  const transport = raw.transport === 'stdio' || raw.transport === 'streamable-http'
    ? raw.transport
    : undefined
  const serverName = typeof raw.serverName === 'string' ? raw.serverName : undefined
  const command = typeof raw.command === 'string' ? raw.command : undefined
  const args = Array.isArray(raw.args)
    ? raw.args.filter((arg): arg is string => typeof arg === 'string')
    : undefined
  const url = typeof raw.url === 'string' ? raw.url : undefined
  const cwd = typeof raw.cwd === 'string' ? raw.cwd : undefined
  const envKeys = keyNames(raw.env)
  const headerKeys = keyNames(raw.headers)
  const toolCallTimeoutMs = optionalNumber(raw.toolCallTimeoutMs)
  const failOnStartupError = optionalBoolean(raw.failOnStartupError)
  const reconnectRaw = raw.reconnect
  let reconnect: McpServerView['reconnect']
  if (typeof reconnectRaw === 'object' && reconnectRaw !== null) {
    const record = reconnectRaw as Record<string, unknown>
    const initialDelayMs = optionalNumber(record.initialDelayMs)
    const maxDelayMs = optionalNumber(record.maxDelayMs)
    const maxAttempts = optionalNumber(record.maxAttempts)
    reconnect = {
      enabled: record.enabled !== false,
      ...(initialDelayMs === undefined ? {} : { initialDelayMs }),
      ...(maxDelayMs === undefined ? {} : { maxDelayMs }),
      ...(maxAttempts === undefined ? {} : { maxAttempts }),
    }
  }
  return {
    ...(serverName === undefined ? {} : { serverName }),
    ...(transport === undefined ? {} : { transport }),
    ...(command === undefined ? {} : { command }),
    ...(args === undefined || args.length === 0 ? {} : { args }),
    ...(url === undefined ? {} : { url }),
    ...(cwd === undefined ? {} : { cwd }),
    ...(envKeys === undefined ? {} : { envKeys }),
    ...(headerKeys === undefined ? {} : { headerKeys }),
    ...(toolCallTimeoutMs === undefined ? {} : { toolCallTimeoutMs }),
    ...(failOnStartupError === undefined ? {} : { failOnStartupError }),
    ...(reconnect === undefined ? {} : { reconnect }),
  }
}

/** Project one Loader entry: identity, enablement, phase, and redacted config. */
function toView(entry: {
  readonly id: string
  readonly disabled: boolean
  readonly options: { readonly config?: unknown }
  readonly fiber?: { readonly state: FiberState }
}): McpServerView {
  return {
    entryId: mcpEntryId(entry.id),
    enabled: !entry.disabled,
    fiberPhase: entry.fiber === undefined ? null : FIBER_PHASE[entry.fiber.state],
    ...projectConfig(entry.options.config),
  }
}

/**
 * Merge a submitted secret map against the stored one: an empty submitted
 * value means "keep the old value" (or drop the key when none exists), so the
 * editor can show configured keys redacted without forcing a re-enter.
 */
function mergeSecretMap(oldMap: unknown, submitted: Record<string, string>): Record<string, string> | undefined {
  const oldRecord = typeof oldMap === 'object' && oldMap !== null
    ? oldMap as Record<string, unknown>
    : {}
  const merged: Record<string, string> = {}
  for (const [key, value] of Object.entries(submitted)) {
    if (value !== '') {
      merged[key] = value
      continue
    }
    const previous = oldRecord[key]
    if (typeof previous === 'string') merged[key] = previous
  }
  return Object.keys(merged).length === 0 ? undefined : merged
}

/** Resolve one validated config against the stored entry, merging kept secrets. */
function resolveStoredConfig(config: McpServerConfigInput, previous: unknown): McpServerConfigInput {
  if (config.transport === 'stdio') {
    // The raw env carries redacted placeholders that must not be persisted
    // verbatim: only the merge result (or nothing) reaches the stored entry.
    const { env, ...rest } = config
    const merged = env === undefined ? undefined : mergeSecretMap(
      (previous as Record<string, unknown> | undefined)?.env,
      env,
    )
    return {
      ...rest,
      ...merged === undefined ? {} : { env: merged },
    }
  }
  const { headers, ...rest } = config
  const mergedHeaders = headers === undefined ? undefined : mergeSecretMap(
    (previous as Record<string, unknown> | undefined)?.headers,
    headers,
  )
  return {
    ...rest,
    ...mergedHeaders === undefined ? {} : { headers: mergedHeaders },
  }
}

/** Remote-only service exposing the Loader's configured MCP server entries. */
export class McpInventoryGateway extends TypertRemoteService {
  static inject = ['loader']

  constructor(ctx: Context) {
    super(ctx, 'mcpInventory')
  }

  /**
   * Read the Loader directly on every call — Cordis's internal plugin/status
   * events already maintain Entry.fiber and Fiber.state, so a second cache
   * would only add another lifecycle truth to keep synchronized.
   * @returns Configured mcp-client entries in Loader order, secrets redacted.
   */
  @Remote('list')
  list(): McpInventorySnapshot {
    const entries: McpServerView[] = []
    for (const entry of this.ctx.loader.entries()) {
      if (entry.options.group) continue
      if (!isMcpClientEntry(entry.options.name)) continue
      entries.push(toView(entry))
    }
    return { entries }
  }

  /**
   * Create or replace one MCP server in the home-level user patch layer. The
   * launcher's config HMR restarts the mcp-client fiber with the new config,
   * so a persisted edit takes effect without a process restart. Secrets the
   * client submits (env/header values) are persisted verbatim but never appear
   * in later read views; an empty submitted value keeps the stored one.
   * @param input - validated server config (see {@link validateServerConfig}).
   * @returns the projected view of the persisted server entry.
   */
  @Remote('upsert')
  upsert(input: McpServerConfigInput): McpServerView {
    const config = validateServerConfig(input)
    const entries = readHomePatchEntries()
    const mcpEntries = entries.filter(entry => isMcpClientEntry(entry.name))
    const existing = mcpEntries.find(entry =>
      (entry.config as Record<string, unknown> | undefined)?.serverName === config.serverName)
    if (existing !== undefined) {
      const stored = resolveStoredConfig(config, existing.config)
      const next = mcpEntries.map(entry => entry === existing
        ? { id: existing.id, name: existing.name, config: stored }
        : entry)
      writeHomePatchEntries(next)
      return {
        entryId: mcpEntryId(existing.id),
        enabled: true,
        fiberPhase: null,
        ...projectConfig(stored),
      }
    }
    const id = `mcp-${config.serverName}`
    if (entries.some(entry => entry.id === id && !isMcpClientEntry(entry.name))) {
      throw new Error(`patch entry id "${id}" is already used by a non-MCP plugin`)
    }
    const stored = resolveStoredConfig(config, undefined)
    writeHomePatchEntries([...mcpEntries, { id, name: MCP_CLIENT_MODULE, config: stored }])
    return {
      entryId: mcpEntryId(id),
      enabled: true,
      fiberPhase: null,
      ...projectConfig(stored),
    }
  }

  /**
   * Remove one MCP server from the home-level user patch layer. The config HMR
   * then unloads its fiber and unregisters the server's tools. Named
   * `removeServer` because `remove` collides with the typert Remote namespace
   * service's own method.
   * @param serverName - the server's stable local namespace.
   * @returns whether a matching server entry existed.
   */
  @Remote('removeServer')
  removeServer(serverName: string): McpRemoveResult {
    const entries = readHomePatchEntries()
    const mcpEntries = entries.filter(entry => isMcpClientEntry(entry.name))
    const next = mcpEntries.filter(entry =>
      (entry.config as Record<string, unknown> | undefined)?.serverName !== serverName)
    const removed = next.length !== mcpEntries.length
    writeHomePatchEntries(next)
    return { removed }
  }
}

export default McpInventoryGateway
