/**
 * Skills settings surface, browser half — one section whose feature-owned tabs
 * show the current project's skill catalog, read through the session-addressed
 * `skill.list` RPC: a plain catalog list and a provider/source grouping.
 * Read-only by design: skill discovery roots live in the deployment and the
 * agent presets, so editing them is a separate, write-path milestone.
 */

import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import { resolveSlotLabel } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: pulls the locale plugin's Context merge (ctx.locale) and the
// settings shell's SlotMap merge (the 'settings.section' entry).
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import { SkillsConfigTab, type SkillsConfigTabInjected } from './SkillsConfigTab.tsx'
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
export type { SkillsConfigTabInjected, SkillsConfigTabProps, SkillSourceGroup } from './SkillsConfigTab.tsx'
export { groupSkills } from './SkillsConfigTab.tsx'
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
export const inject = ['slots', 'locale', 'connection', 'sessions']

/**
 * Mount the Skills settings section and its two read-only tabs.
 * @param ctx - the browser plugin context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-settings-skills: section dictionaries')

  const t = ctx.locale.bind(NS)
  const { api } = ctx.get('connection') as ConnectionHandle

  const list = async (): Promise<SkillListResult> => {
    const sessionId = ctx.sessions.list.getSnapshot().current
    if (sessionId === undefined) return { sessionless: true, skills: [] }
    const response = await api.skills.list({ sessionId })
    if (!response.result.ok) {
      throw new Error(`skills.list failed: ${response.result.error.code}: ${response.result.error.message}`)
    }
    return { sessionless: false, skills: response.result.value.skills }
  }
  const listInjected = (): SkillsListTabInjected => ({ list })
  const configInjected = (): SkillsConfigTabInjected => ({ list })

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
    yield ctx.slots.register({
      name: 'settings.skills.tab',
      id: 'list',
      order: 0,
      label: () => t('listTab'),
      locale: NS,
      inject: listInjected,
    }, SkillsListTab)
    yield ctx.slots.register({
      name: 'settings.skills.tab',
      id: 'config',
      order: 10,
      label: () => t('configTab'),
      locale: NS,
      inject: configInjected,
    }, SkillsConfigTab)
  })
}
