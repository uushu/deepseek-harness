/**
 * Client-submitted MCP server config validation. Kept local to this package
 * (no dependency on the mcp-client plugin): the loader schema is the
 * authoritative runtime check, this mirror exists to fail loud at the settings
 * boundary with actionable messages and to normalize the stored entry.
 *
 * @module @deepseek-ai/dsh-host-mcp-inventory/config
 */

import type {
  McpHttpConfigInput,
  McpReconnectInput,
  McpServerConfigInput,
  McpStdioConfigInput,
} from './types.ts'

/** Valid `serverName`, kept below the public tool-name budget. */
const SERVER_NAME_PATTERN = /^[A-Za-z0-9_-]{1,32}$/

/** Reject a value unless it is a positive finite integer. */
function positiveInteger(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new Error(`${field} must be a positive integer`)
  }
  return value
}

/** Reject a value unless it is a string map. */
function stringMap(value: unknown, field: string): Record<string, string> | undefined {
  if (value === undefined) return undefined
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${field} must be a string map`)
  }
  const record = value as Record<string, unknown>
  for (const [key, entry] of Object.entries(record)) {
    if (typeof entry !== 'string') throw new Error(`${field}.${key} must be a string`)
  }
  return record as Record<string, string>
}

/** Reject a value unless it is a string list. */
function stringList(value: unknown, field: string): string[] | undefined {
  if (value === undefined) return undefined
  if (!Array.isArray(value)) throw new Error(`${field} must be a string list`)
  const entries = value.filter((entry): entry is string => typeof entry === 'string')
  if (entries.length !== value.length) {
    throw new Error(`${field} must be a string list`)
  }
  return entries
}

/** Validate the reconnect policy when present. */
function reconnect(value: unknown): McpReconnectInput | undefined {
  if (value === undefined) return undefined
  if (typeof value !== 'object' || value === null) throw new Error('reconnect must be an object')
  const raw = value as Record<string, unknown>
  if (typeof raw.enabled !== 'boolean') throw new Error('reconnect.enabled must be a boolean')
  const initialDelayMs = positiveIntegerOrUndefined(raw.initialDelayMs, 'reconnect.initialDelayMs')
  const maxDelayMs = positiveIntegerOrUndefined(raw.maxDelayMs, 'reconnect.maxDelayMs')
  const maxAttempts = positiveIntegerOrUndefined(raw.maxAttempts, 'reconnect.maxAttempts')
  return {
    enabled: raw.enabled,
    ...initialDelayMs === undefined ? {} : { initialDelayMs },
    ...maxDelayMs === undefined ? {} : { maxDelayMs },
    ...maxAttempts === undefined ? {} : { maxAttempts },
  }
}

/** Positive integer when present, or undefined for an absent optional field. */
function positiveIntegerOrUndefined(value: unknown, field: string): number | undefined {
  return value === undefined ? undefined : positiveInteger(value, field)
}

/** Optional boolean field. */
function optionalBoolean(value: unknown, field: string): boolean | undefined {
  if (value === undefined) return undefined
  if (typeof value !== 'boolean') throw new Error(`${field} must be a boolean`)
  return value
}

/** Optional non-empty string field. */
function optionalString(value: unknown, field: string): string | undefined {
  if (value === undefined) return undefined
  if (typeof value !== 'string') throw new Error(`${field} must be a string`)
  const trimmed = value.trim()
  return trimmed.length === 0 ? undefined : trimmed
}

/** Common optional fields shared by both transports. */
function commonFields(raw: Record<string, unknown>): Pick<
  McpStdioConfigInput | McpHttpConfigInput,
  'toolCallTimeoutMs' | 'failOnStartupError' | 'reconnect'
> {
  const toolCallTimeoutMs = positiveIntegerOrUndefined(raw.toolCallTimeoutMs, 'toolCallTimeoutMs')
  const failOnStartupError = optionalBoolean(raw.failOnStartupError, 'failOnStartupError')
  const policy = reconnect(raw.reconnect)
  return {
    ...toolCallTimeoutMs === undefined ? {} : { toolCallTimeoutMs },
    ...failOnStartupError === undefined ? {} : { failOnStartupError },
    ...policy === undefined ? {} : { reconnect: policy },
  }
}

/**
 * Validate and normalize one client-submitted MCP server config.
 * @param input - the raw payload from the settings boundary.
 * @returns the normalized config in the loader's own shape.
 * @throws when a field fails validation; the message is user-actionable.
 */
export function validateServerConfig(input: unknown): McpServerConfigInput {
  if (typeof input !== 'object' || input === null) throw new Error('config must be an object')
  const raw = input as Record<string, unknown>
  const transport = raw.transport
  if (transport !== 'stdio' && transport !== 'streamable-http') {
    throw new Error('transport must be "stdio" or "streamable-http"')
  }
  const serverName = typeof raw.serverName === 'string' ? raw.serverName : ''
  if (!SERVER_NAME_PATTERN.test(serverName)) {
    throw new Error('serverName must match [A-Za-z0-9_-]{1,32}')
  }
  const shared = commonFields(raw)
  if (transport === 'stdio') {
    const command = typeof raw.command === 'string' ? raw.command : ''
    if (command.length === 0) throw new Error('stdio transport requires a command')
    const args = stringList(raw.args, 'args')
    const env = stringMap(raw.env, 'env')
    const cwd = optionalString(raw.cwd, 'cwd')
    return {
      transport,
      serverName,
      command,
      ...args === undefined || args.length === 0 ? {} : { args },
      ...env === undefined || Object.keys(env).length === 0 ? {} : { env },
      ...cwd === undefined ? {} : { cwd },
      ...shared,
    } satisfies McpStdioConfigInput
  }
  const url = typeof raw.url === 'string' ? raw.url : ''
  if (url.length === 0) throw new Error('streamable-http transport requires a url')
  const headers = stringMap(raw.headers, 'headers')
  return {
    transport,
    serverName,
    url,
    ...headers === undefined || Object.keys(headers).length === 0 ? {} : { headers },
    ...shared,
  } satisfies McpHttpConfigInput
}
