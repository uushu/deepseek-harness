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

/** Reconnect policy a client may submit for one MCP server. */
export interface McpReconnectInput {
  readonly enabled: boolean
  readonly initialDelayMs?: number
  readonly maxDelayMs?: number
  readonly maxAttempts?: number
}

/** stdio transport config a client submits when creating or editing a server. */
export interface McpStdioConfigInput {
  readonly transport: 'stdio'
  /** Stable local namespace; must match `[A-Za-z0-9_-]{1,32}` and be unique. */
  readonly serverName: string
  readonly command: string
  readonly args?: readonly string[]
  readonly env?: Readonly<Record<string, string>>
  readonly cwd?: string
  readonly toolCallTimeoutMs?: number
  readonly failOnStartupError?: boolean
  readonly reconnect?: McpReconnectInput
}

/** streamable-http transport config a client submits when creating or editing a server. */
export interface McpHttpConfigInput {
  readonly transport: 'streamable-http'
  /** Stable local namespace; must match `[A-Za-z0-9_-]{1,32}` and be unique. */
  readonly serverName: string
  readonly url: string
  readonly headers?: Readonly<Record<string, string>>
  readonly toolCallTimeoutMs?: number
  readonly failOnStartupError?: boolean
  readonly reconnect?: McpReconnectInput
}

/** Configuration a client submits to create or edit one MCP server. */
export type McpServerConfigInput = McpStdioConfigInput | McpHttpConfigInput

/** Result of removing one MCP server. */
export interface McpRemoveResult {
  /** Whether a matching server entry existed in the user patch layer. */
  readonly removed: boolean
}
