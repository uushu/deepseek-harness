/**
 * Harness skin client plugin body: the toggleable glass skin. Owns the durable
 * enable flag + knobs (localStorage), applies/retracts the skin layer through
 * {@link HarnessLayer}, and registers two settings surfaces:
 * - the master on/off card into the Plugins section (`settings.plugin.item`);
 * - the blur/frost knobs into the General section's Appearance row area
 *   (`settings.general.item`, right under 外观).
 * One click on the master switch returns the stock UI (every layer is an
 * effect, disposed on flip). No core DSH source is modified.
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type { BoundActions } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Type-only: pulls the `settings.plugin.item` SlotMap merge.
import type {} from '@deepseek-ai/dsh-client-ui-settings-plugins/client'
// Type-only: pulls the `settings.general.item` SlotMap merge.
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import { HarnessPluginCard, type HarnessPluginCardInjected } from './HarnessPluginCard.tsx'
import { HarnessKnobs, type HarnessKnobsInjected } from './HarnessKnobs.tsx'
import { createHarnessRowStore } from './settings-store.ts'
import { en, NS, zh, type HarnessKey } from './locales.ts'
import { HarnessLayer, type HarnessSettings } from './harness-layer.ts'
// Side-effect imports: the skin stylesheet (gated on html[data-dsh-harness])
// and the self-hosted @font-face declarations.
import './harness.module.css'
import './fonts.module.css'

export type { HarnessPluginCardComponentProps, HarnessPluginCardInjected } from './HarnessPluginCard.tsx'
export type { HarnessKnobsComponentProps, HarnessKnobsInjected } from './HarnessKnobs.tsx'
export type { HarnessRowState } from './settings-store.ts'
export type { HarnessKey } from './locales.ts'
export type { HarnessSettings } from './harness-layer.ts'
export { NS } from './locales.ts'
export { HARNESS_ATTRIBUTE, HARNESS_ENABLED_KEY, HarnessLayer } from './harness-layer.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Harness skin settings copy. */
    'settings.harness': HarnessKey
  }
}

/** Required services: the theme override stack plus the settings surfaces. */
export const inject = ['theme', 'slots', 'locale']

/**
 * Client plugin body.
 * @param ctx - client cordis context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-harness: settings dictionaries')

  // The layer owns its lifecycle: enable flag, token stack, CSS attribute,
  // ambient scene, and seams are all effects released on disable/dispose.
  const layer = new HarnessLayer(ctx)

  const pluginStore = createHarnessRowStore()
  const knobsStore = createHarnessRowStore()
  let pluginBound: BoundActions<typeof pluginStore> | undefined
  let knobsBound: BoundActions<typeof knobsStore> | undefined
  let revision = 0
  const state = (): Omit<HarnessSettings & { enabled: boolean }, 'revision'> => ({
    enabled: layer.getEnabled(),
    ...layer.getSettings(),
  })
  const sync = (): void => {
    const next = state()
    pluginBound?.sync(next, revision)
    knobsBound?.sync(next, revision)
    revision += 1
  }

  const pluginInjected = (actions: BoundActions<typeof pluginStore>): HarnessPluginCardInjected => {
    pluginBound = actions
    sync()
    return {
      setEnabled: (enabled) => {
        layer.setEnabled(enabled)
        sync()
      },
    }
  }
  const knobsInjected = (actions: BoundActions<typeof knobsStore>): HarnessKnobsInjected => {
    knobsBound = actions
    sync()
    return {
      setBlur: (value) => {
        layer.setBlur(value)
        sync()
      },
      setFrost: (value) => {
        layer.setFrost(value)
        sync()
      },
    }
  }

  // Master switch card in the Plugins configurable tab.
  ctx.slots.inject('settings.plugin.item', () => ctx.slots.register({
    name: 'settings.plugin.item',
    id: 'harness',
    order: 5,
    store: pluginStore,
    locale: NS,
    inject: pluginInjected,
  }, HarnessPluginCard))

  // Glass knobs in the General section, directly under the Appearance row (10).
  ctx.slots.inject('settings.general.item', () => ctx.slots.register({
    name: 'settings.general.item',
    id: 'harness',
    order: 11,
    store: knobsStore,
    locale: NS,
    inject: knobsInjected,
  }, HarnessKnobs))
}
