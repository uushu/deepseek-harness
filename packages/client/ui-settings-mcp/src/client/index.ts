/**
 * MCP settings surface, browser half — one section whose feature-owned tabs
 * show the deployment's configured MCP servers: editable config cards that
 * persist into the home-level user patch layer (`$DSH_HOME/cordis.patch.yml`,
 * picked up by the config HMR) and a read-only instance inventory.
 */

import type { McpInventorySnapshot, McpServerConfigInput, McpServerView } from '@deepseek-ai/dsh-api-remotes/client'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import { resolveSlotLabel } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: pulls the locale plugin's Context merge (ctx.locale) and the
// settings shell's SlotMap merge (the 'settings.section' entry).
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import { McpConfigTab, type McpConfigTabInjected } from './McpConfigTab.tsx'
import { McpInventoryTab, type McpInventoryTabInjected } from './McpInventoryTab.tsx'
import {
  McpSettingsSection,
  type McpSettingsSectionInjected,
  type McpSettingsTabEntry,
} from './McpSettingsSection.tsx'
import { en, zh, type McpSettingsLocaleKey } from './locales.ts'

export type { McpSettingsSectionInjected, McpSettingsSectionProps } from './McpSettingsSection.tsx'
export type { McpConfigTabInjected, McpConfigTabProps } from './McpConfigTab.tsx'
export type { McpInventoryTabInjected, McpInventoryTabProps } from './McpInventoryTab.tsx'
export type { McpSettingsLocaleKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** MCP section, tab, and server-card copy. */
    'settings.mcp': McpSettingsLocaleKey
  }
}

/** Dictionary namespace owned by this plugin. */
export const NS = 'settings.mcp'

/** Required services (cordis fiber inject). */
export const inject = ['slots', 'locale', 'remote', 'remote.mcpInventory']

/**
 * Mount the MCP settings section and its two read-only tabs.
 * @param ctx - the browser plugin context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-settings-mcp: section dictionaries')

  const t = ctx.locale.bind(NS)
  const list = async (): Promise<McpInventorySnapshot> => {
    const result = await ctx.remote.mcpInventory.list()
    if (!result.ok) {
      throw new Error(`mcpInventory.list failed: ${result.error.code}: ${result.error.message}`)
    }
    return result.value
  }
  // The config tab edits the PATCH configuration items (listConfig); the
  // inventory tab shows the live loader instances (list). A configured server
  // only appears in the list once the config HMR has created its fiber.
  const listConfig = async (): Promise<McpInventorySnapshot> => {
    const result = await ctx.remote.mcpInventory.listConfig()
    if (!result.ok) {
      throw new Error(`mcpInventory.listConfig failed: ${result.error.code}: ${result.error.message}`)
    }
    return result.value
  }
  const upsert = async (config: McpServerConfigInput): Promise<McpServerView> => {
    const result = await ctx.remote.mcpInventory.upsert(config)
    if (!result.ok) {
      throw new Error(`mcpInventory.upsert failed: ${result.error.code}: ${result.error.message}`)
    }
    return result.value
  }
  const removeServer = async (serverName: string): Promise<{ removed: boolean }> => {
    const result = await ctx.remote.mcpInventory.removeServer(serverName)
    if (!result.ok) {
      throw new Error(`mcpInventory.removeServer failed: ${result.error.code}: ${result.error.message}`)
    }
    return result.value
  }
  const configInjected = (): McpConfigTabInjected => ({ listConfig, upsert, removeServer })
  const inventoryInjected = (): McpInventoryTabInjected => ({ list })

  let tabsVersion = -1
  let tabsRevision = -1
  let tabs: readonly McpSettingsTabEntry[] = []
  const sectionInjected = (): McpSettingsSectionInjected => ({
    hooks: {
      tabs: {
        getSnapshot: () => {
          const version = ctx.slots.getVersion('settings.mcp.tab')
          const revision = ctx.locale.getSnapshot().revision
          if (version !== tabsVersion || revision !== tabsRevision) {
            tabsVersion = version
            tabsRevision = revision
            tabs = ctx.slots.entries('settings.mcp.tab')
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
          const offLedger = ctx.slots.subscribe('settings.mcp.tab', listener)
          const offLocale = ctx.locale.subscribe(listener)
          return () => {
            offLedger()
            offLocale()
          }
        },
      },
    },
  })

  // This package owns the one MCP navigation entry and the tab chrome; both
  // tabs below are registered into the section's own tab slot.
  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'mcp',
    order: 16,
    label: () => t('nav'),
    locale: NS,
    inject: sectionInjected,
    children: { 'settings.mcp.tab': { kind: 'list', scope: 'root' } },
  }, McpSettingsSection))

  ctx.slots.inject('settings.mcp.tab', function* () {
    yield ctx.slots.register({
      name: 'settings.mcp.tab',
      id: 'config',
      order: 0,
      label: () => t('configTab'),
      locale: NS,
      inject: configInjected,
    }, McpConfigTab)
    yield ctx.slots.register({
      name: 'settings.mcp.tab',
      id: 'inventory',
      order: 10,
      label: () => t('inventoryTab'),
      locale: NS,
      inject: inventoryInjected,
    }, McpInventoryTab)
  })
}
