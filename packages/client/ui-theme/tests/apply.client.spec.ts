/** ui-theme apply wiring: service provision, settings dictionaries riding the
 * locale service, preference roundtrips through the Host settings, and
 * teardown dictionary disposal. (The Appearance row moved to ui-harness's
 * theme tabs; this suite asserts the service contract that remains.) */
import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it, vi } from 'vitest'
import { SlotRegistry } from '@deepseek-ai/dsh-client-runtime/client'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import { TestRemote } from '@deepseek-ai/dsh-client-test-runtime'
import { apply as settingsApply, inject as settingsInject } from '@deepseek-ai/dsh-client-ui-settings/client'
import { apply, inject, SETTINGS_NS } from '@deepseek-ai/dsh-client-ui-theme/client'
import type { ThemeRuntime } from '@deepseek-ai/dsh-client-ui-theme/client'
import { THEME_SETTINGS_NAMESPACE, ThemeSettingsSchema } from '../src/theme-settings.ts'

// These specs assert the shipped Chinese copy. The lane has no jsdom `window`,
// so browser-language detection never runs and a fresh LocaleRuntime opens on
// FALLBACK_LOCALE (en); bench stages zh explicitly on the locale instead.

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => { resolve = done })
  return { promise, resolve }
}

async function bench(isLoopback = true) {
  const ctx = new Context()
  await ctx.plugin(SlotRegistry).await()
  const locale = new LocaleRuntime(ctx)
  locale.setLocale('zh')
  ctx.provide('locale', locale)
  let preference = 'system'
  const namespace = () => ({
    ns: THEME_SETTINGS_NAMESPACE,
    schema: ThemeSettingsSchema.toJSON(),
    value: { preference },
    applies: 'live' as const,
    secrets: [],
    revision: 0,
  })
  const describe = vi.fn(() => Promise.resolve({
    rpcId: 'theme-describe' as never,
    result: {
      ok: true as const,
      value: { writable: true, hasDocument: true, namespaces: [namespace()] },
    },
  }))
  const mutate = vi.fn((request: { ops: { value: string }[] }) => {
    preference = request.ops[0]!.value
    return Promise.resolve({
      rpcId: 'theme-mutate' as never,
      result: { ok: true as const, value: namespace() },
    })
  })
  ctx.provide('connection', { api: { settings: { describe, mutate } }, isLoopback } as never)
  new TestRemote(ctx)
  await ctx.plugin({ inject: [...settingsInject], apply: settingsApply }).await()
  return {
    ctx, locale, describe, mutate,
    setHostPreference: (next: string) => { preference = next },
  }
}

describe('ui-theme apply', () => {
  it('declares its service dependencies', () => {
    expect(inject).toEqual(['slots', 'locale', 'connection', 'remote', 'settingsScope'])
  })

  it('provides the theme service and registers localized copy', async () => {
    const b = await bench()
    await b.ctx.plugin({ inject: [...inject], apply }).await()
    expect(b.ctx.get('theme')).toBeDefined()
    expect(b.locale.bind(SETTINGS_NS)('appearance.title')).toBe('外观')
    b.locale.setLocale('en')
    expect(b.locale.bind(SETTINGS_NS)('appearance.title')).toBe('Appearance')
    await b.ctx.fiber.dispose()
  })

  it('routes setTheme writes through the Host settings and back into getTheme', async () => {
    const b = await bench()
    await b.ctx.plugin({ inject: [...inject], apply }).await()
    const theme = b.ctx.get('theme') as ThemeRuntime
    theme.setTheme('dark')
    expect(theme.getTheme().preference).toBe('dark')
    theme.setTheme('system')
    expect(theme.getTheme().preference).toBe('system')
    await vi.waitFor(() => { expect(b.mutate).toHaveBeenCalledTimes(2) })
    await b.ctx.fiber.dispose()
  })

  it('loads Host settings at boot and keeps remote browsers process-local', async () => {
    const b = await bench()
    // The shared mirror read once at bench time; a Host-side change reaches it
    // through the document invalidation, exactly as production announces one.
    b.setHostPreference('dark')
    b.ctx.remote.$dispatch('settings/document-updated', [THEME_SETTINGS_NAMESPACE, 0])
    await b.ctx.plugin({ inject: [...inject], apply }).await()
    const theme = b.ctx.get('theme') as ThemeRuntime
    await vi.waitFor(() => { expect(theme.getTheme().preference).toBe('dark') })
    // The mirror refreshes on every document commit (ns-agnostic); the scope's
    // derived value only moves when its own namespace changed.
    b.ctx.remote.$dispatch('settings/document-updated', ['unrelated', 0])
    await vi.waitFor(() => { expect(b.describe).toHaveBeenCalledTimes(3) })
    expect(theme.getTheme().preference).toBe('dark')
    b.setHostPreference('light')
    b.ctx.remote.$dispatch('settings/document-updated', [THEME_SETTINGS_NAMESPACE, 0])
    await vi.waitFor(() => { expect(theme.getTheme().preference).toBe('light') })

    const remote = await bench(false)
    await remote.ctx.plugin({ inject: [...inject], apply }).await()
    const remoteTheme = remote.ctx.get('theme') as ThemeRuntime
    remoteTheme.setTheme('dark')
    await Promise.resolve()
    expect(remote.describe).not.toHaveBeenCalled()
    expect(remote.mutate).not.toHaveBeenCalled()
  })

  it('activates before a slow settings refresh and converges when it settles', async () => {
    const b = await bench()
    b.setHostPreference('dark')
    const describe = b.describe.getMockImplementation()!
    const pending = deferred<Awaited<ReturnType<typeof describe>>>()
    b.describe.mockImplementationOnce(() => pending.promise)
    // The refresh hangs on the wire; the mirror keeps serving the last good
    // answer, so activation never blocks on the settings transport.
    b.ctx.remote.$dispatch('settings/document-updated', [THEME_SETTINGS_NAMESPACE, 0])
    const fiber = b.ctx.plugin({ inject: [...inject], apply })
    await fiber.await()
    const theme = b.ctx.get('theme') as ThemeRuntime
    expect(theme.getTheme().preference).toBe('system')
    pending.resolve(await describe())
    await vi.waitFor(() => { expect(theme.getTheme().preference).toBe('dark') })
    await fiber.dispose()
  })

  it('ignores an invalid preference crossing the settings wire', async () => {
    const b = await bench()
    b.setHostPreference('sepia')
    b.ctx.remote.$dispatch('settings/document-updated', [THEME_SETTINGS_NAMESPACE, 0])
    await b.ctx.plugin({ inject: [...inject], apply }).await()
    const theme = b.ctx.get('theme') as ThemeRuntime
    await vi.waitFor(() => { expect(b.describe).toHaveBeenCalledTimes(2) })
    expect(theme.getTheme().preference).toBe('system')
  })

  it('teardown removes the dictionaries', async () => {
    const b = await bench()
    const fiber = b.ctx.plugin({ inject: [...inject], apply })
    await fiber.await()
    await fiber.dispose()
    // Dictionary disposal: translation falls back to the bare key.
    expect(b.locale.bind(SETTINGS_NS)('appearance.title')).toBe('appearance.title')
  })
})
