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
import type { SkillsListTabInjected } from '../src/client/SkillsListTab.tsx'

usePinnedBrowserLanguages('zh-CN')
afterEach(cleanup)

/** Minimal sessions face: the current selection snapshot the list reads. */
function sessionsWith(current: string | undefined) {
  return { list: { getSnapshot: () => ({ current }) } }
}

async function bench(current: string | undefined = undefined) {
  const ctx = new Context()
  await ctx.plugin(SlotRegistry).await()
  const locale = new LocaleRuntime(ctx)
  ctx.provide('locale', locale)
  const api = { skills: { list: vi.fn<() => Promise<unknown>>() } }
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
    expect(tabs.map(entry => [entry.options.id, entry.component])).toEqual([
      ['list', SkillsListTab],
      ['config', SkillsConfigTab],
    ])
    expect(resolveSlotLabel(tabs[0]!.options.label)).toBe('技能列表')
    expect(resolveSlotLabel(tabs[1]!.options.label)).toBe('技能配置')
    expect(b.api.skills.list).not.toHaveBeenCalled()

    const injected = (section.inject as unknown as () => SkillsSettingsSectionInjected)()
    expect(injected.hooks.tabs.getSnapshot().map(row => row.id)).toEqual(['list', 'config'])
    expect(b.api.skills.list).not.toHaveBeenCalled()

    await b.ctx.fiber.dispose()
  })

  it('addresses the current session and fails loud when the RPC rejects', async () => {
    const b = await bench('s1')
    declareRoot(b.slots)
    await b.ctx.plugin({ inject: [...inject], apply }).await()
    const listTab = b.slots.entries('settings.skills.tab')[0]!
    const injected = (listTab.inject as unknown as () => SkillsListTabInjected)()

    b.api.skills.list.mockResolvedValueOnce(okSkillList([
      { name: 'demo', description: 'd', modelInvocable: true, provider: 'filesystem', source: 'project-dsh' },
    ]))
    await expect(injected.list()).resolves.toEqual({
      sessionless: false,
      skills: [{ name: 'demo', description: 'd', modelInvocable: true, provider: 'filesystem', source: 'project-dsh' }],
    })
    expect(b.api.skills.list).toHaveBeenCalledWith({ sessionId: 's1' })

    b.api.skills.list.mockResolvedValueOnce({ result: { ok: false, error: { code: 'REMOTE_ERROR', message: 'unavailable' } } })
    await expect(injected.list()).rejects.toThrow('skills.list failed: REMOTE_ERROR: unavailable')
    await b.ctx.fiber.dispose()
  })

  it('returns sessionless without any RPC when no session is current', async () => {
    const b = await bench(undefined)
    declareRoot(b.slots)
    await b.ctx.plugin({ inject: [...inject], apply }).await()
    const listTab = b.slots.entries('settings.skills.tab')[0]!
    const injected = (listTab.inject as unknown as () => SkillsListTabInjected)()
    await expect(injected.list()).resolves.toEqual({ sessionless: true, skills: [] })
    expect(b.api.skills.list).not.toHaveBeenCalled()
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
    expect(resolveSlotLabel(b.slots.entries('settings.skills.tab')[1]!.options.label)).toBe('Skill configuration')

    stop()
    expect(b.slots.entries('settings.skills.tab')).toHaveLength(0)
    declareRoot(b.slots)
    await vi.waitFor(() => {
      expect(b.slots.entries('settings.skills.tab')[0]?.component).toBe(SkillsListTab)
    })

    await fiber.dispose()
    expect(b.slots.entries('settings.skills.tab')).toHaveLength(0)
    expect(() => b.locale.register(NS, 'zh', {})).not.toThrow()
    await b.ctx.fiber.dispose()
  })
})
