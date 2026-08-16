// @vitest-environment jsdom
import { Context } from '@deepseek-ai/cordis'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import { SlotRegistry } from '@deepseek-ai/dsh-client-runtime/client'
import { resolveSlotLabel } from '@deepseek-ai/dsh-client-ui-slots'
import { usePinnedBrowserLanguages } from '@deepseek-ai/dsh-client-test-runtime'
import { apply, inject, NS } from '../src/client/index.ts'
import { SkillsConfigTab } from '../src/client/SkillsConfigTab.tsx'
import { SkillsListTab } from '../src/client/SkillsListTab.tsx'
import { SkillsSettingsSection } from '../src/client/SkillsSettingsSection.tsx'
import type { SkillsSettingsSectionInjected } from '../src/client/SkillsSettingsSection.tsx'
import type { SkillsConfigTabInjected } from '../src/client/SkillsConfigTab.tsx'
import type { SkillsListTabInjected } from '../src/client/SkillsListTab.tsx'

usePinnedBrowserLanguages('zh-CN')
afterEach(cleanup)

/** Minimal sessions face: the current selection snapshot the list reads. */
function sessionsWith(current: string | undefined) {
  return { list: { getSnapshot: () => ({ current }) } }
}

async function bench(current?: string) {
  const ctx = new Context()
  await ctx.plugin(SlotRegistry).await()
  const locale = new LocaleRuntime(ctx)
  ctx.provide('locale', locale)
  const api = {
    skills: {
      list: vi.fn<() => Promise<unknown>>(),
      read: vi.fn<() => Promise<unknown>>(),
      write: vi.fn<() => Promise<unknown>>(),
      remove: vi.fn<() => Promise<unknown>>(),
    },
  }
  ctx.provide('connection', { api })
  ctx.provide('sessions', sessionsWith(current))
  return { ctx, slots: ctx.get('slots') as SlotRegistry, locale, api }
}

/** Declare the settings-section seat the section registers into. */
function declareRoot(slots: SlotRegistry): () => void {
  return slots.register({
    name: 'root',
    children: { 'settings.section': { kind: 'list', scope: 'root' } },
  } as never, () => null)
}

function okSkillList(skills: unknown) {
  return { result: { ok: true as const, value: { skills } } }
}

describe('ui-settings-skills browser plugin', () => {
  it('declares only the services used by the Settings contributions', () => {
    expect(inject).toEqual(['slots', 'locale', 'connection', 'sessions'])
  })

  it('registers the section and both localized tabs without reading the catalog eagerly', async () => {
    const b = await bench('s1')
    declareRoot(b.slots)
    await b.ctx.plugin({ inject: [...inject], apply }).await()

    const section = b.slots.entries('settings.section')[0]!
    expect(section.component).toBe(SkillsSettingsSection)
    expect(section.options).toMatchObject({ id: 'skills', order: 17 })
    expect(section.locale).toBe(NS)
    expect(resolveSlotLabel(section.options.label)).toBe('技能')

    const tabs = b.slots.entries('settings.skills.tab')
    expect(tabs).toHaveLength(2)
    // The configuration tab comes first, mirroring the MCP section.
    expect(tabs.map(entry => [entry.options.id, entry.component])).toEqual([
      ['config', SkillsConfigTab],
      ['list', SkillsListTab],
    ])
    expect(resolveSlotLabel(tabs[0]!.options.label)).toBe('技能配置')
    expect(resolveSlotLabel(tabs[1]!.options.label)).toBe('技能列表')
    expect(b.api.skills.list).not.toHaveBeenCalled()

    await b.ctx.fiber.dispose()
  })

  it('injects a live tab projection with cache, subscription, and locale recompute', async () => {
    const b = await bench('s1')
    declareRoot(b.slots)
    await b.ctx.plugin({ inject: [...inject], apply }).await()

    const section = b.slots.entries('settings.section')[0]!
    const sectionFace = (section.inject as unknown as () => SkillsSettingsSectionInjected)()
    const initialTabs = sectionFace.hooks.tabs.getSnapshot()
    expect(initialTabs).toEqual([
      { id: 'config', order: 0, label: '技能配置' },
      { id: 'list', order: 10, label: '技能列表' },
    ])
    // A stable snapshot is cached until the ledger or the locale moves.
    expect(sectionFace.hooks.tabs.getSnapshot()).toBe(initialTabs)

    const listener = vi.fn()
    const unsubscribe = sectionFace.hooks.tabs.subscribe(listener)
    // A contribution without id/order/label exercises the projection defaults.
    b.slots.register({ name: 'settings.skills.tab', id: 'plain' } as never, () => null)
    expect(sectionFace.hooks.tabs.getSnapshot()).toEqual([
      { id: 'config', order: 0, label: '技能配置' },
      { id: 'plain', order: 0, label: '' },
      { id: 'list', order: 10, label: '技能列表' },
    ])
    await vi.waitFor(() => { expect(listener).toHaveBeenCalled() })
    unsubscribe()

    // A locale move re-projects labels even when the ledger itself is stable.
    b.locale.setLocale('en')
    expect(sectionFace.hooks.tabs.getSnapshot()[0]?.label).toBe('Skill configuration')

    await b.ctx.fiber.dispose()
  })

  it('addresses the current session and fails loud when the RPC rejects', async () => {
    const b = await bench('s1')
    declareRoot(b.slots)
    await b.ctx.plugin({ inject: [...inject], apply }).await()
    b.api.skills.list.mockResolvedValue(okSkillList([
      { name: 'demo', description: 'd', modelInvocable: true, provider: 'filesystem', source: 'project-dsh' },
    ]))
    const listTab = b.slots.entries('settings.skills.tab')[1]!
    const injected = (listTab.inject as unknown as () => SkillsListTabInjected)()

    await expect(injected.list()).resolves.toEqual({
      sessionless: false,
      skills: [{ name: 'demo', description: 'd', modelInvocable: true, provider: 'filesystem', source: 'project-dsh' }],
    })
    expect(b.api.skills.list).toHaveBeenCalledWith({ sessionId: 's1' })

    b.api.skills.list.mockResolvedValueOnce({ result: { ok: false, error: { code: 'REMOTE_ERROR', message: 'unavailable' } } })
    await expect(injected.list()).rejects.toThrow('skills.list failed: REMOTE_ERROR: unavailable')

    // The config tab shares the same catalog face plus the write verbs.
    const configTab = b.slots.entries('settings.skills.tab')[0]!
    const configInjected = (configTab.inject as unknown as () => SkillsConfigTabInjected)()
    await expect(configInjected.list()).resolves.toEqual({
      sessionless: false,
      skills: [{ name: 'demo', description: 'd', modelInvocable: true, provider: 'filesystem', source: 'project-dsh' }],
    })
    expect(b.api.skills.list).toHaveBeenCalledTimes(3)

    b.api.skills.read.mockResolvedValueOnce({ result: { ok: true, value: { content: 'body' } } })
    await expect(configInjected.read('demo')).resolves.toBe('body')
    expect(b.api.skills.read).toHaveBeenCalledWith({ sessionId: 's1', name: 'demo' })
    b.api.skills.read.mockResolvedValueOnce({ result: { ok: false, error: { code: 'REMOTE_ERROR', message: 'unavailable' } } })
    await expect(configInjected.read('demo')).rejects.toThrow('skills.read failed: REMOTE_ERROR: unavailable')

    b.api.skills.write.mockResolvedValueOnce({ result: { ok: true, value: { name: 'demo' } } })
    await expect(configInjected.write({ name: 'demo', description: 'd', modelInvocable: true, content: 'b' }))
      .resolves.toEqual({ name: 'demo' })
    expect(b.api.skills.write).toHaveBeenCalledWith({
      sessionId: 's1',
      skill: { name: 'demo', description: 'd', modelInvocable: true, content: 'b' },
    })
    b.api.skills.write.mockResolvedValueOnce({ result: { ok: false, error: { code: 'REMOTE_ERROR', message: 'unavailable' } } })
    await expect(configInjected.write({ name: 'demo', description: 'd', modelInvocable: true, content: 'b' }))
      .rejects.toThrow('skills.write failed: REMOTE_ERROR: unavailable')

    b.api.skills.remove.mockResolvedValueOnce({ result: { ok: true, value: { removed: true } } })
    await expect(configInjected.remove('demo')).resolves.toEqual({ removed: true })
    expect(b.api.skills.remove).toHaveBeenCalledWith({ sessionId: 's1', name: 'demo' })
    b.api.skills.remove.mockResolvedValueOnce({ result: { ok: false, error: { code: 'REMOTE_ERROR', message: 'unavailable' } } })
    await expect(configInjected.remove('demo')).rejects.toThrow('skills.remove failed: REMOTE_ERROR: unavailable')
    await b.ctx.fiber.dispose()
  })

  it('returns sessionless without any RPC when no session is current', async () => {
    const b = await bench(undefined)
    declareRoot(b.slots)
    await b.ctx.plugin({ inject: [...inject], apply }).await()
    const listTab = b.slots.entries('settings.skills.tab')[1]!
    const injected = (listTab.inject as unknown as () => SkillsListTabInjected)()
    await expect(injected.list()).resolves.toEqual({ sessionless: true, skills: [] })
    expect(b.api.skills.list).not.toHaveBeenCalled()
    await b.ctx.fiber.dispose()
  })

  it('refuses the write verbs without a current session', async () => {
    const b = await bench(undefined)
    declareRoot(b.slots)
    await b.ctx.plugin({ inject: [...inject], apply }).await()
    const configTab = b.slots.entries('settings.skills.tab')[0]!
    const injected = (configTab.inject as unknown as () => SkillsConfigTabInjected)()
    await expect(injected.read('demo')).rejects.toThrow('skills require an open session')
    await expect(injected.write({ name: 'demo', description: 'd', modelInvocable: true, content: 'b' }))
      .rejects.toThrow('skills require an open session')
    await expect(injected.remove('demo')).rejects.toThrow('skills require an open session')
    expect(b.api.skills.read).not.toHaveBeenCalled()
    expect(b.api.skills.write).not.toHaveBeenCalled()
    expect(b.api.skills.remove).not.toHaveBeenCalled()
    await b.ctx.fiber.dispose()
  })

  it('follows locale and recovers across late declaration and declarer reload', async () => {
    const b = await bench('s1')
    const fiber = b.ctx.plugin({ inject: [...inject], apply })
    await fiber.await()
    expect(b.slots.entries('settings.skills.tab')).toHaveLength(0)

    const stop = declareRoot(b.slots)
    await vi.waitFor(() => { expect(b.slots.entries('settings.skills.tab')).toHaveLength(2) })
    b.locale.setLocale('en')
    expect(resolveSlotLabel(b.slots.entries('settings.skills.tab')[1]!.options.label)).toBe('Skill list')

    stop()
    expect(b.slots.entries('settings.skills.tab')).toHaveLength(0)
    declareRoot(b.slots)
    await vi.waitFor(() => {
      expect(b.slots.entries('settings.skills.tab')[0]?.component).toBe(SkillsConfigTab)
    })

    await fiber.dispose()
    expect(b.slots.entries('settings.skills.tab')).toHaveLength(0)
    expect(() => b.locale.register(NS, 'zh', {})).not.toThrow()
    await b.ctx.fiber.dispose()
  })
})
