// @vitest-environment jsdom
/** ui-harness apply wiring: the Aqua layer is constructed (skin on by default:
 * the html attribute + the token override mount), and the two settings
 * surfaces register with the standard store/locale/inject seats — the Plugins
 * master card (keyed by the settings namespace) and the Theme section (the
 * nav entry right below General). Teardown removes both and the layer. */
import { Context } from '@deepseek-ai/cordis'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SlotRegistry } from '@deepseek-ai/dsh-client-runtime/client'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import { apply, inject, NS } from '@deepseek-ai/dsh-client-ui-harness/client'
import { AquaPluginCard } from '../src/client/AquaPluginCard.tsx'
import { ThemeSection } from '../src/client/ThemeSection.tsx'
import { AQUA_ATTRIBUTE } from '../src/client/theme-layer.ts'

const PLUGIN_SLOT = 'settings.plugin.item'
const SECTION_SLOT = 'settings.section'

const ctxs: Context[] = []

/** jsdom lacks matchMedia; the ambient decorations read it to pick their
 *  reduced-motion / coarse-pointer behavior. */
function stubMatchMedia(): void {
  window.matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
  } as MediaQueryList)
}

/** Build a context with the two slots the plugin registers into, plus the
 *  theme/locale services; the layer's enable flag is seeded from `enabled`. */
async function bench(enabled: boolean) {
  localStorage.setItem('dsh.ui-aqua.enabled', String(enabled))
  const ctx = new Context()
  await ctx.plugin(SlotRegistry).await()
  ctx.provide('locale', new LocaleRuntime(ctx))
  ctx.provide('theme', {
    getTheme: () => ({
      preference: 'dark',
      active: { id: 'dark', colorScheme: 'dark', tokens: {} },
      themes: [],
      revision: 0,
    }),
    setTheme: () => {},
    overrideTokens: () => () => {},
  } as never)
  // Declare both slots from root (the settings shells declare them in the app).
  ;(ctx.get('slots') as SlotRegistry).register(
    {
      name: 'root',
      children: {
        [PLUGIN_SLOT]: { kind: 'keyed', scope: 'root' },
        [SECTION_SLOT]: { kind: 'list', scope: 'root' },
      },
    } as never,
    () => null,
  )
  ctxs.push(ctx)
  return ctx
}

beforeEach(() => {
  stubMatchMedia()
  localStorage.clear()
  document.documentElement.removeAttribute(AQUA_ATTRIBUTE)
  document.querySelectorAll('[data-dsh-aqua-ambient], [data-dsh-aqua-wallpaper-layer], [data-dsh-aqua-fade]')
    .forEach((el) => { el.remove() })
})

afterEach(async () => {
  // Fiber dispose releases the layer's listeners and effects.
  for (const c of ctxs.splice(0)) { await c.fiber.dispose() }
  vi.restoreAllMocks()
})

describe('ui-harness apply', () => {
  it('declares its service dependencies', () => {
    expect(inject).toEqual(['theme', 'slots', 'locale'])
  })

  it('registers the Plugins master card and the Theme section with the skin locale', async () => {
    const ctx = await bench(true)
    await ctx.plugin({ inject: [...inject], apply }).await()
    const slots = ctx.get('slots') as SlotRegistry
    const card = slots.entries(PLUGIN_SLOT).find(e => e.component === AquaPluginCard)
    const section = slots.entries(SECTION_SLOT).find(e => e.component === ThemeSection)
    expect(card).toMatchObject({ options: { key: 'settings.aqua' }, locale: NS })
    expect(section).toMatchObject({ options: { id: 'theme', order: 1 }, locale: NS })
    // The skin is on by default: the layer mounted the html attribute.
    expect(document.documentElement.hasAttribute(AQUA_ATTRIBUTE)).toBe(true)
  })

  it('teardown removes both registrations and the layer', async () => {
    const ctx = await bench(true)
    const fiber = ctx.plugin({ inject: [...inject], apply })
    await fiber.await()
    const slots = ctx.get('slots') as SlotRegistry
    expect(slots.entries(PLUGIN_SLOT)).toHaveLength(1)
    expect(slots.entries(SECTION_SLOT)).toHaveLength(1)
    await fiber.dispose()
    expect(slots.entries(PLUGIN_SLOT)).toHaveLength(0)
    expect(slots.entries(SECTION_SLOT)).toHaveLength(0)
    expect(document.documentElement.hasAttribute(AQUA_ATTRIBUTE)).toBe(false)
  })

  it('a disabled skin still registers the settings surfaces without mounting the layer', async () => {
    const ctx = await bench(false)
    await ctx.plugin({ inject: [...inject], apply }).await()
    const slots = ctx.get('slots') as SlotRegistry
    expect(slots.entries(PLUGIN_SLOT)).toHaveLength(1)
    expect(slots.entries(SECTION_SLOT)).toHaveLength(1)
    expect(document.documentElement.hasAttribute(AQUA_ATTRIBUTE)).toBe(false)
  })
})
