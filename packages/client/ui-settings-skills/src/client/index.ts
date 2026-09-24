/**
 * Skills settings surface, browser half — one section whose feature-owned tabs
 * show the current project's Skills and create project-owned Skill files.
 * Catalog reads and writes are session-addressed: the Host resolves the saved
 * Session cwd, so the browser never supplies a filesystem path.
 */

import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-api-session-controller/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { resolveSlotLabel } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: pulls the locale plugin's Context merge (ctx.locale) and the
// settings shell's SlotMap merge (the 'settings.section' entry).
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
// Type-only: pulls the SlotRegistry service merge (ctx.slots).
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import {
  SkillsConfigTab,
  type SkillWriteInput,
  type SkillsConfigTabInjected,
} from './SkillsConfigTab.tsx'
import {
  SkillsListTab,
  type SkillListResult,
  type SkillsListTabInjected,
} from './SkillsListTab.tsx'
import {
  SkillsSettingsSection,
  type SkillsSettingsSectionInjected,
  type SkillsSettingsTabEntry,
} from './SkillsSettingsSection.tsx'
import { en, zh, type SkillsSettingsLocaleKey } from './locales.ts'

export type { SkillsSettingsSectionInjected, SkillsSettingsSectionProps } from './SkillsSettingsSection.tsx'
export type { SkillsListTabInjected, SkillsListTabProps, SkillListResult } from './SkillsListTab.tsx'
export type { SkillsConfigTabInjected, SkillsConfigTabProps, SkillWriteInput } from './SkillsConfigTab.tsx'
export type { SkillsSettingsLocaleKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Skills section and tab copy. */
    'settings.skills': SkillsSettingsLocaleKey
  }
}

/** Dictionary namespace owned by this plugin. */
export const NS = 'settings.skills'

/** Required services (cordis fiber inject). */
export const inject = ['slots', 'locale', 'sessions', 'remote', 'remote.skills']

/**
 * Mount the Skills settings section and its two tabs.
 * @param ctx - the browser plugin context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-settings-skills: section dictionaries')

  const t = ctx.locale.bind(NS)
  const list = async (): Promise<SkillListResult> => {
    const sessionId = ctx.sessions.list.getSnapshot().current
    if (sessionId === undefined) return { sessionless: true, skills: [] }
    // Settings surfaces also show model-only entries, while the composer asks
    // for the smaller human-invocable catalog.
    const response = await ctx.remote.skills.list(
      { sessionId, includeInternal: true },
      new AbortController().signal,
    )
    if (!response.ok) {
      throw new Error(`skills.list failed: ${response.error.code}: ${response.error.message}`)
    }
    return { sessionless: false, skills: response.value.skills }
  }
  const withSession = async <T>(call: (sessionId: SessionId) => Promise<T>): Promise<T> => {
    const sessionId = ctx.sessions.list.getSnapshot().current
    if (sessionId === undefined) throw new Error('skills require an open session')
    return await call(sessionId)
  }
  const write = (skill: SkillWriteInput): Promise<{ name: string }> =>
    withSession(async (sessionId) => {
      const response = await ctx.remote.skills.write({ sessionId, skill })
      if (!response.ok) {
        throw new Error(`skills.write failed: ${response.error.code}: ${response.error.message}`)
      }
      return response.value
    })
  const listInjected = (): SkillsListTabInjected => ({ list })
  const configInjected = (): SkillsConfigTabInjected => ({ write })

  let tabsVersion = -1
  let tabsRevision = -1
  let tabs: readonly SkillsSettingsTabEntry[] = []
  const sectionInjected = (): SkillsSettingsSectionInjected => ({
    hooks: {
      tabs: {
        getSnapshot: () => {
          const version = ctx.slots.getVersion('settings.skills.tab')
          const revision = ctx.locale.getSnapshot().revision
          if (version !== tabsVersion || revision !== tabsRevision) {
            tabsVersion = version
            tabsRevision = revision
            tabs = ctx.slots.entries('settings.skills.tab')
              .map(entry => ({
                /* v8 ignore next -- list-slot registration requires id */
                id: entry.options.id ?? '',
                order: entry.options.order ?? 0,
                label: resolveSlotLabel(entry.options.label) ?? '',
              }))
              .sort((a, b) => a.order - b.order)
          }
          return tabs
        },
        subscribe: (listener) => {
          const offLedger = ctx.slots.subscribe('settings.skills.tab', listener)
          const offLocale = ctx.locale.subscribe(listener)
          return () => {
            offLedger()
            offLocale()
          }
        },
      },
    },
  })

  // This package owns the one Skills navigation entry and the tab chrome; both
  // tabs below are registered into the section's own tab slot.
  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'skills',
    order: 17,
    label: () => t('nav'),
    locale: NS,
    inject: sectionInjected,
    children: { 'settings.skills.tab': { kind: 'list', scope: 'root' } },
  }, SkillsSettingsSection))

  ctx.slots.inject('settings.skills.tab', function* () {
    // The configuration tab comes first, mirroring the MCP section.
    yield ctx.slots.register({
      name: 'settings.skills.tab',
      id: 'config',
      order: 0,
      label: () => t('configTab'),
      locale: NS,
      inject: configInjected,
    }, SkillsConfigTab)
    yield ctx.slots.register({
      name: 'settings.skills.tab',
      id: 'list',
      order: 10,
      label: () => t('listTab'),
      locale: NS,
      inject: listInjected,
    }, SkillsListTab)
  })
}
