// @vitest-environment jsdom
import { Context, Service } from '@deepseek-ai/cordis'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import { SlotRegistry } from '@deepseek-ai/dsh-client-runtime/client'
import { resolveSlotLabel } from '@deepseek-ai/dsh-client-ui-slots'
import { usePinnedBrowserLanguages } from '@deepseek-ai/dsh-client-test-runtime'
import { apply, inject, NS } from '../src/client/index.ts'
import { McpConfigTab } from '../src/client/McpConfigTab.tsx'
import { McpInventoryTab } from '../src/client/McpInventoryTab.tsx'
import { McpSettingsSection } from '../src/client/McpSettingsSection.tsx'
import type { McpSettingsSectionInjected } from '../src/client/McpSettingsSection.tsx'
import type { McpConfigTabInjected } from '../src/client/McpConfigTab.tsx'
import type { McpInventoryTabInjected } from '../src/client/McpInventoryTab.tsx'

usePinnedBrowserLanguages('zh-CN')
afterEach(cleanup)

const EMPTY = { entries: [] }
type ListResult =
  | { readonly ok: true; readonly value: typeof EMPTY }
  | { readonly ok: false; readonly error: { readonly code: string; readonly message: string } }

type WriteResult =
  | { readonly ok: true; readonly value: { entryId: string; serverName: string; transport: 'stdio'; enabled: true; fiberPhase: null } }
  | { readonly ok: false; readonly error: { readonly code: string; readonly message: string } }

async function bench() {
  const ctx = new Context()
  await ctx.plugin(SlotRegistry).await()
  const locale = new LocaleRuntime(ctx)
  ctx.provide('locale', locale)
  class RemoteService extends Service {
    constructor(serviceCtx: Context) {
      super(serviceCtx, 'remote')
    }
  }
  new RemoteService(ctx)
  const list = vi.fn<() => Promise<ListResult>>()
    .mockResolvedValue({ ok: true, value: EMPTY })
  const upsert = vi.fn<() => Promise<WriteResult>>()
    .mockResolvedValue({ ok: true, value: { entryId: 'mcp-fs', serverName: 'fs', transport: 'stdio', enabled: true, fiberPhase: null } })
  ctx.provide('remote.mcpInventory', { list, upsert })
  return { ctx, slots: ctx.get('slots') as SlotRegistry, locale, list, upsert }
}

/** Declare the settings-section seat the section registers into. */
function declareRoot(slots: SlotRegistry): () => void {
  return slots.register({
    name: 'root',
    children: { 'settings.section': { kind: 'list', scope: 'root' } },
  } as never, () => null)
}

describe('ui-settings-mcp browser plugin', () => {
  it('declares only the services used by the Settings contributions', () => {
    expect(inject).toEqual(['slots', 'locale', 'remote', 'remote.mcpInventory'])
  })

  it('registers the section and both localized tabs without reading the Remote eagerly', async () => {
    const b = await bench()
    declareRoot(b.slots)
    await b.ctx.plugin({ inject: [...inject], apply }).await()

    const section = b.slots.entries('settings.section')[0]!
    expect(section.component).toBe(McpSettingsSection)
    expect(section.options).toMatchObject({ id: 'mcp', order: 16 })
    expect(section.locale).toBe(NS)
    expect(resolveSlotLabel(section.options.label)).toBe('MCP')

    const tabs = b.slots.entries('settings.mcp.tab')
    expect(tabs).toHaveLength(2)
    expect(tabs.map(entry => [entry.options.id, entry.component])).toEqual([
      ['config', McpConfigTab],
      ['inventory', McpInventoryTab],
    ])
    expect(resolveSlotLabel(tabs[0]!.options.label)).toBe('MCP 配置')
    expect(resolveSlotLabel(tabs[1]!.options.label)).toBe('MCP 列表')
    expect(b.list).not.toHaveBeenCalled()

    await b.ctx.fiber.dispose()
  })

  it('injects a live tab projection with cache, subscription, and locale recompute', async () => {
    const b = await bench()
    declareRoot(b.slots)
    await b.ctx.plugin({ inject: [...inject], apply }).await()

    const section = b.slots.entries('settings.section')[0]!
    const sectionFace = (section.inject as unknown as () => McpSettingsSectionInjected)()
    const initialTabs = sectionFace.hooks.tabs.getSnapshot()
    expect(initialTabs).toEqual([
      { id: 'config', order: 0, label: 'MCP 配置' },
      { id: 'inventory', order: 10, label: 'MCP 列表' },
    ])
    // A stable snapshot is cached until the ledger or the locale moves.
    expect(sectionFace.hooks.tabs.getSnapshot()).toBe(initialTabs)

    const listener = vi.fn()
    const unsubscribe = sectionFace.hooks.tabs.subscribe(listener)
    // A contribution without id/order/label exercises the projection defaults.
    b.slots.register({ name: 'settings.mcp.tab', id: 'plain' } as never, () => null)
    expect(sectionFace.hooks.tabs.getSnapshot()).toEqual([
      { id: 'config', order: 0, label: 'MCP 配置' },
      { id: 'plain', order: 0, label: '' },
      { id: 'inventory', order: 10, label: 'MCP 列表' },
    ])
    await vi.waitFor(() => { expect(listener).toHaveBeenCalled() })
    unsubscribe()

    // A locale move re-projects labels even when the ledger itself is stable.
    b.locale.setLocale('en')
    expect(sectionFace.hooks.tabs.getSnapshot()[0]?.label).toBe('MCP configuration')

    // The config tab is a write-only form: upsert forwards with error mapping.
    const configFace = (tabsOf(b)[0]!.inject as unknown as () => McpConfigTabInjected)()
    await expect(configFace.upsert({ transport: 'stdio', serverName: 'fs', command: 'node' })).resolves
      .toMatchObject({ serverName: 'fs' })
    expect(b.upsert).toHaveBeenCalledWith({ transport: 'stdio', serverName: 'fs', command: 'node' })
    b.upsert.mockResolvedValueOnce({ ok: false, error: { code: 'REMOTE_ERROR', message: 'unavailable' } })
    await expect(configFace.upsert({ transport: 'stdio', serverName: 'fs', command: 'node' }))
      .rejects.toThrow('mcpInventory.upsert failed: REMOTE_ERROR: unavailable')

    // The inventory tab reads the live loader list. Success and failure paths.
    const inventoryTab = tabsOf(b).find(entry => entry.options.id === 'inventory')!
    const inventoryFace = (inventoryTab.inject as unknown as () => McpInventoryTabInjected)()
    await expect(inventoryFace.list()).resolves.toEqual(EMPTY)
    b.list.mockResolvedValueOnce({ ok: false, error: { code: 'REMOTE_ERROR', message: 'unavailable' } })
    await expect(inventoryFace.list()).rejects.toThrow('mcpInventory.list failed: REMOTE_ERROR: unavailable')

    await b.ctx.fiber.dispose()
  })

  it('follows locale and recovers across late declaration and declarer reload', async () => {
    const b = await bench()
    const fiber = b.ctx.plugin({ inject: [...inject], apply })
    await fiber.await()
    expect(b.slots.entries('settings.mcp.tab')).toHaveLength(0)

    const stop = declareRoot(b.slots)
    await vi.waitFor(() => { expect(b.slots.entries('settings.mcp.tab')).toHaveLength(2) })
    b.locale.setLocale('en')
    expect(resolveSlotLabel(b.slots.entries('settings.mcp.tab')[1]!.options.label)).toBe('MCP list')

    stop()
    expect(b.slots.entries('settings.mcp.tab')).toHaveLength(0)
    declareRoot(b.slots)
    await vi.waitFor(() => {
      expect(b.slots.entries('settings.mcp.tab')[0]?.component).toBe(McpConfigTab)
    })

    await fiber.dispose()
    expect(b.slots.entries('settings.mcp.tab')).toHaveLength(0)
    expect(() => b.locale.register(NS, 'zh', {})).not.toThrow()
    await b.ctx.fiber.dispose()
  })
})

function tabsOf(b: Awaited<ReturnType<typeof bench>>) {
  return b.slots.entries('settings.mcp.tab')
}
