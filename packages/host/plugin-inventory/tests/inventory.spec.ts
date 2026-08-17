import { afterEach, describe, expect, it } from 'vitest'
import { Context, type Plugin } from '@deepseek-ai/cordis'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import { remoteMethods } from '@deepseek-ai/dsh-typert-protocol'
import PluginInventoryGateway, { isMcpClientName } from '../src/index.ts'

const contexts: Context[] = []

afterEach(async () => {
  await Promise.all(contexts.splice(0).map(ctx => ctx.fiber.dispose()))
})

const activePlugin: Plugin.Function = () => {}
const pendingPlugin: Plugin.Object = {
  inject: ['neverReady'],
  apply() {},
}

async function harness(): Promise<{
  ctx: Context
  inventory: PluginInventoryGateway
}> {
  const ctx = new Context()
  contexts.push(ctx)
  await ctx.plugin(Loader)
  ctx.loader.builtins.active = activePlugin
  ctx.loader.builtins.pending = pendingPlugin
  ctx.loader.builtins['@deepseek-ai/dsh-mcp-client'] = activePlugin
  ctx.loader.builtins['sub/@deepseek-ai/dsh-mcp-client'] = activePlugin
  await ctx.plugin(PluginInventoryGateway)
  const inventory = ctx.get('pluginInventory') as PluginInventoryGateway
  return { ctx, inventory }
}

describe('PluginInventoryGateway', () => {
  it('publishes one direct list method under the pluginInventory namespace', async () => {
    const { inventory } = await harness()
    expect(inventory.typertRemote).toMatchObject({
      serviceKey: 'pluginInventory',
      namespace: 'pluginInventory',
    })
    expect(remoteMethods(inventory)).toEqual([
      { method: 'list', invocation: { kind: 'direct' } },
    ])
  })

  it('projects current non-group Loader entries without a second cache', async () => {
    const { ctx, inventory } = await harness()
    const activeId = await ctx.loader.create({ name: 'cordis:active' })
    const pendingId = await ctx.loader.create({ name: 'cordis:pending' })
    const disabledId = await ctx.loader.create({
      name: 'cordis:not-installed',
      disabled: true,
    })
    await ctx.loader.create({ name: 'cordis:active', group: true })

    const snapshot = inventory.list()
    expect(snapshot.entries).toHaveLength(3)
    expect(snapshot.entries).toEqual(expect.arrayContaining([
      {
        entryId: activeId,
        moduleName: 'cordis:active',
        enabled: true,
        fiberPhase: 'active',
      },
      {
        entryId: pendingId,
        moduleName: 'cordis:pending',
        enabled: true,
        fiberPhase: 'pending',
      },
      {
        entryId: disabledId,
        moduleName: 'cordis:not-installed',
        enabled: false,
        fiberPhase: null,
      },
    ]))

    await ctx.loader.update(activeId, { disabled: true })
    expect(inventory.list().entries.find(entry => entry.entryId === activeId)).toEqual({
      entryId: activeId,
      moduleName: 'cordis:active',
      enabled: false,
      fiberPhase: null,
    })

    await ctx.loader.remove(pendingId)
    expect(inventory.list().entries.some(entry => entry.entryId === pendingId)).toBe(false)
  })

  it('excludes mcp-client server instances (owned by the MCP settings section)', async () => {
    const { ctx, inventory } = await harness()
    const regularId = await ctx.loader.create({ name: 'cordis:active' })
    const mcpId = await ctx.loader.create({
      name: 'cordis:@deepseek-ai/dsh-mcp-client',
      config: { transport: 'stdio', serverName: 'fs', command: 'node' },
    })
    const scopedMcpId = await ctx.loader.create({
      name: 'cordis:sub/@deepseek-ai/dsh-mcp-client',
      config: { transport: 'streamable-http', serverName: 'remote', url: 'https://x' },
    })

    const snapshot = inventory.list()
    expect(Array.from(ctx.loader.entries())).toHaveLength(3)
    expect(snapshot.entries).toEqual([
      { entryId: regularId, moduleName: 'cordis:active', enabled: true, fiberPhase: 'active' },
    ])
    expect(snapshot.entries.some(entry => entry.entryId === mcpId)).toBe(false)
    expect(snapshot.entries.some(entry => entry.entryId === scopedMcpId)).toBe(false)
  })

  it('recognizes mcp-client module names in both the cordis and bare forms', () => {
    expect(isMcpClientName('cordis:@deepseek-ai/dsh-mcp-client')).toBe(true)
    expect(isMcpClientName('@deepseek-ai/dsh-mcp-client')).toBe(true)
    expect(isMcpClientName('cordis:sub/@deepseek-ai/dsh-mcp-client')).toBe(true)
    expect(isMcpClientName('cordis:active')).toBe(false)
  })
})
