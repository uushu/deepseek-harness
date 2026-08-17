// @vitest-environment jsdom
/** ui-harness apply wiring: the layer is constructed, and the two settings
 * surfaces (Plugins master card + General knobs) register with the standard
 * store/locale/inject seats; teardown removes them. */
import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it } from 'vitest'
import { SlotRegistry } from '@deepseek-ai/dsh-client-runtime/client'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import { apply, inject, NS } from '@deepseek-ai/dsh-client-ui-harness/client'
import { HarnessPluginCard } from '../src/client/HarnessPluginCard.tsx'
import { HarnessKnobs } from '../src/client/HarnessKnobs.tsx'
import { HARNESS_ATTRIBUTE } from '../src/client/harness-layer.ts'

const PLUGIN_SLOT = 'settings.plugin.item'
const KNOBS_SLOT = 'settings.general.item'

async function bench() {
  const ctx = new Context()
  await ctx.plugin(SlotRegistry).await()
  ctx.provide('locale', new LocaleRuntime(ctx))
  ctx.provide('theme', { overrideTokens: () => () => {} } as never)
  // Declare both slots from root (the settings shells declare them in the app).
  ;(ctx.get('slots') as SlotRegistry).register(
    {
      name: 'root',
      children: {
        [PLUGIN_SLOT]: { kind: 'list', scope: 'root' },
        [KNOBS_SLOT]: { kind: 'list', scope: 'root' },
      },
    } as never,
    () => null,
  )
  return ctx
}

describe('ui-harness apply', () => {
  it('declares its service dependencies', () => {
    expect(inject).toEqual(['theme', 'slots', 'locale'])
  })

  it('registers the Plugins card and the General knobs with the skin locale', async () => {
    const ctx = await bench()
    await ctx.plugin({ inject: [...inject], apply }).await()
    const slots = ctx.get('slots') as SlotRegistry
    const card = slots.entries(PLUGIN_SLOT).find(e => e.component === HarnessPluginCard)
    const knobs = slots.entries(KNOBS_SLOT).find(e => e.component === HarnessKnobs)
    expect(card).toMatchObject({ options: { id: 'harness', order: 5 }, locale: NS })
    expect(knobs).toMatchObject({ options: { id: 'harness', order: 11 }, locale: NS })
    // The skin is on by default: the html attribute is set by the layer.
    expect(document.documentElement.hasAttribute(HARNESS_ATTRIBUTE)).toBe(true)
    await ctx.fiber.dispose()
  })

  it('teardown removes both registrations and the skin layer', async () => {
    const ctx = await bench()
    const fiber = ctx.plugin({ inject: [...inject], apply })
    await fiber.await()
    const slots = ctx.get('slots') as SlotRegistry
    expect(slots.entries(PLUGIN_SLOT)).toHaveLength(1)
    expect(slots.entries(KNOBS_SLOT)).toHaveLength(1)
    await fiber.dispose()
    expect(slots.entries(PLUGIN_SLOT)).toHaveLength(0)
    expect(slots.entries(KNOBS_SLOT)).toHaveLength(0)
    expect(document.documentElement.hasAttribute(HARNESS_ATTRIBUTE)).toBe(false)
  })
})
