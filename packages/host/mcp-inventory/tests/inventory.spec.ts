import { afterEach, describe, expect, it } from 'vitest'
import { Context, type Plugin } from '@deepseek-ai/cordis'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import { remoteMethods } from '@deepseek-ai/dsh-typert-protocol'
import McpInventoryGateway from '../src/index.ts'

const contexts: Context[] = []

afterEach(async () => {
  await Promise.all(contexts.splice(0).map(ctx => ctx.fiber.dispose()))
})

const activePlugin: Plugin.Function = () => {}
const pendingPlugin: Plugin.Object = {
  inject: ['neverReady'],
  apply() {},
}

/** Loader module specifier under which mcp-client entries are configured. */
const MCP_MODULE = '@deepseek-ai/dsh-mcp-client'

/** Entry name form the Loader resolves through the builtins record. */
const MCP_BUILTIN = `cordis:${MCP_MODULE}`

async function harness(): Promise<{
  ctx: Context
  inventory: McpInventoryGateway
}> {
  const ctx = new Context()
  contexts.push(ctx)
  await ctx.plugin(Loader)
  ctx.loader.builtins.active = activePlugin
  ctx.loader.builtins.pending = pendingPlugin
  // Resolve the mcp-client module specifier inside the Loader so entries
  // configured under it can be created without importing the real plugin.
  ctx.loader.builtins[MCP_MODULE] = activePlugin
  await ctx.plugin(McpInventoryGateway)
  const inventory = ctx.get('mcpInventory') as McpInventoryGateway
  return { ctx, inventory }
}

/** One mcp-client row config in the loader's own resolved shape. */
const STDIO_CONFIG = {
  transport: 'stdio',
  serverName: 'fs',
  command: 'node',
  args: ['server.mjs', '--port', '3000'],
  env: { TOKEN: 'secret-value', DEBUG: '1' },
  cwd: '/srv/mcp',
  toolCallTimeoutMs: 30_000,
  failOnStartupError: true,
  reconnect: { enabled: true, initialDelayMs: 100, maxDelayMs: 5000, maxAttempts: 10 },
}

describe('McpInventoryGateway', () => {
  it('publishes list, upsert, and removeServer under the mcpInventory namespace', async () => {
    const { inventory } = await harness()
    expect(inventory.typertRemote).toMatchObject({
      serviceKey: 'mcpInventory',
      namespace: 'mcpInventory',
    })
    expect(remoteMethods(inventory)).toEqual([
      { method: 'list', invocation: { kind: 'direct' } },
      { method: 'upsert', invocation: { kind: 'direct' } },
      { method: 'removeServer', invocation: { kind: 'direct' } },
    ])
  })

  it('projects only mcp-client Loader entries, redacting env and header values', async () => {
    const { ctx, inventory } = await harness()
    const stdioId = await ctx.loader.create({
      name: MCP_BUILTIN,
      config: STDIO_CONFIG,
    })
    const httpId = await ctx.loader.create({
      name: MCP_BUILTIN,
      config: {
        transport: 'streamable-http',
        serverName: 'remote',
        url: 'https://mcp.example.com/sse',
        headers: { Authorization: 'Bearer secret' },
        toolCallTimeoutMs: 10_000,
      },
    })
    // Non-MCP entries and groups must not appear.
    await ctx.loader.create({ name: 'cordis:active' })
    await ctx.loader.create({ name: MCP_BUILTIN, group: true })

    const snapshot = inventory.list()
    expect(snapshot.entries).toHaveLength(2)
    expect(snapshot.entries).toEqual(expect.arrayContaining([
      {
        entryId: stdioId,
        serverName: 'fs',
        transport: 'stdio',
        enabled: true,
        fiberPhase: 'active',
        command: 'node',
        args: ['server.mjs', '--port', '3000'],
        envKeys: ['TOKEN', 'DEBUG'],
        cwd: '/srv/mcp',
        toolCallTimeoutMs: 30_000,
        failOnStartupError: true,
        reconnect: { enabled: true, initialDelayMs: 100, maxDelayMs: 5000, maxAttempts: 10 },
      },
      {
        entryId: httpId,
        serverName: 'remote',
        transport: 'streamable-http',
        enabled: true,
        fiberPhase: 'active',
        url: 'https://mcp.example.com/sse',
        headerKeys: ['Authorization'],
        toolCallTimeoutMs: 10_000,
      },
    ]))
    // Values never cross the wire.
    const serialized = JSON.stringify(snapshot)
    expect(serialized).not.toContain('secret-value')
    expect(serialized).not.toContain('Bearer secret')
  })

  it('follows enablement and removal like the Loader itself', async () => {
    const { ctx, inventory } = await harness()
    const id = await ctx.loader.create({
      name: MCP_BUILTIN,
      config: { transport: 'stdio', serverName: 'fs', command: 'node' },
    })
    const otherId = await ctx.loader.create({
      name: MCP_BUILTIN,
      config: { transport: 'streamable-http', serverName: 'remote', url: 'https://x' },
      disabled: true,
    })

    expect(inventory.list().entries).toEqual([
      {
        entryId: id,
        serverName: 'fs',
        transport: 'stdio',
        enabled: true,
        fiberPhase: 'active',
        command: 'node',
      },
      {
        entryId: otherId,
        serverName: 'remote',
        transport: 'streamable-http',
        enabled: false,
        fiberPhase: null,
        url: 'https://x',
      },
    ])

    await ctx.loader.update(id, { disabled: true })
    expect(inventory.list().entries.find(entry => entry.entryId === id)).toMatchObject({
      enabled: false,
      fiberPhase: null,
    })

    await ctx.loader.remove(id)
    expect(inventory.list().entries.some(entry => entry.entryId === id)).toBe(false)
  })

  it('projects malformed or sparse configs defensively', async () => {
    const { ctx, inventory } = await harness()
    const malformedId = await ctx.loader.create({
      name: MCP_BUILTIN,
      config: { transport: 'bogus' },
    })
    const bareId = await ctx.loader.create({ name: MCP_BUILTIN })

    const snapshot = inventory.list()
    expect(snapshot.entries).toEqual([
      {
        entryId: malformedId,
        enabled: true,
        fiberPhase: 'active',
      },
      {
        entryId: bareId,
        enabled: true,
        fiberPhase: 'active',
      },
    ])
  })

  it('drops non-string args and empty env/header maps', async () => {
    const { ctx, inventory } = await harness()
    const id = await ctx.loader.create({
      name: MCP_BUILTIN,
      config: {
        transport: 'stdio',
        serverName: 'fs',
        command: 'node',
        args: ['ok', 42, null],
        env: {},
        reconnect: { enabled: false },
      },
    })

    expect(inventory.list().entries).toEqual([
      {
        entryId: id,
        serverName: 'fs',
        transport: 'stdio',
        enabled: true,
        fiberPhase: 'active',
        command: 'node',
        args: ['ok'],
        reconnect: { enabled: false },
      },
    ])
  })
})
