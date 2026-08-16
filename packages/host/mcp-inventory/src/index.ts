/** Read-only projection of the configured MCP servers (Loader mcp-client entries). */

import type { Context, FiberState } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/cordis-plugin-loader'
import { TypertRemoteService, Remote } from '@deepseek-ai/dsh-typert-protocol'
// Typert-generated ./typert and ./remote artifacts import Zod at runtime.
import type {} from 'zod'
import type {
  McpEntryId,
  McpFiberPhase,
  McpInventorySnapshot,
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
function isMcpClientEntry(moduleName: string): boolean {
  const normalized = moduleName.startsWith('cordis:') ? moduleName.slice(7) : moduleName
  return normalized === MCP_CLIENT_MODULE || normalized.endsWith(`/${MCP_CLIENT_MODULE}`)
}

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
}

export default McpInventoryGateway
