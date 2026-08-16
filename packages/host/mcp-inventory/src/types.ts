import type { Branded } from '@deepseek-ai/dsh-brand'

/** Stable Loader-tree identity of one configured mcp-client entry. */
export type McpEntryId = Branded<'McpEntryId'>

/** Lifecycle state of an entry's root Fiber, or null when it has no live root Fiber. */
export type McpFiberPhase =
  | 'pending'
  | 'loading'
  | 'active'
  | 'failed'
  | 'unloading'
  | null

/** Transport kind of one MCP server. */
export type McpTransport = 'stdio' | 'streamable-http'

/** Redacted resolved config of one MCP server, projected for trusted clients. */
export interface McpServerView {
  readonly entryId: McpEntryId
  /** Stable local namespace for this server's model-facing tool names. */
  readonly serverName?: string
  readonly transport?: McpTransport
  /** Effective Loader enablement, including disabled ancestor groups. */
  readonly enabled: boolean
  readonly fiberPhase: McpFiberPhase
  /** stdio transport: executable. */
  readonly command?: string
  /** stdio transport: arguments passed without shell interpolation. */
  readonly args?: readonly string[]
  /** streamable-http transport: MCP endpoint URL. */
  readonly url?: string
  /** stdio transport: working directory for the child process. */
  readonly cwd?: string
  /** stdio transport: env variable NAMES (values never leave the host). */
  readonly envKeys?: readonly string[]
  /** streamable-http transport: header NAMES (values never leave the host). */
  readonly headerKeys?: readonly string[]
  readonly toolCallTimeoutMs?: number
  readonly failOnStartupError?: boolean
  readonly reconnect?: Readonly<{
    enabled: boolean
    initialDelayMs?: number
    maxDelayMs?: number
    maxAttempts?: number
  }>
}

/** Point-in-time MCP server inventory returned by the Remote. */
export interface McpInventorySnapshot {
  readonly entries: readonly McpServerView[]
}
