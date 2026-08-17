// @vitest-environment jsdom
/**
 * HarnessLayer behavior: the skin is on by default, mounts the html attribute
 * + ambient scene + token override, flips off restores the stock state
 * exactly, knobs persist and drive the CSS variables, storage events sync
 * cross-tab, and fiber dispose releases everything.
 */
import { Context } from '@deepseek-ai/cordis'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HARNESS_ATTRIBUTE, HARNESS_ENABLED_KEY, HarnessLayer } from '../src/client/harness-layer.ts'

const ctxs: Context[] = []

function make() {
  const disposer = vi.fn()
  const overrideTokens = vi.fn(() => disposer)
  const ctx = new Context()
  ctx.provide('theme', { overrideTokens } as never)
  ctxs.push(ctx)
  return { ctx, overrideTokens, disposer }
}

beforeEach(() => {
  localStorage.clear()
  document.documentElement.removeAttribute(HARNESS_ATTRIBUTE)
  document.documentElement.style.removeProperty('--dsh-harness-blur')
  document.documentElement.style.removeProperty('--dsh-harness-frost')
  document.querySelectorAll('[data-dsh-harness-ambient]').forEach(el => el.remove())
})

afterEach(async () => {
  // Fiber dispose releases the layer's listeners and effects.
  for (const c of ctxs.splice(0)) { await c.fiber.dispose() }
  vi.restoreAllMocks()
})

describe('HarnessLayer', () => {
  it('defaults to enabled and mounts the attribute, ambient, seams, and token override', () => {
    const { ctx, overrideTokens } = make()
    const layer = new HarnessLayer(ctx)
    expect(layer.getEnabled()).toBe(true)
    expect(document.documentElement.hasAttribute(HARNESS_ATTRIBUTE)).toBe(true)
    expect(overrideTokens).toHaveBeenCalledOnce()
    expect(document.querySelector('[data-dsh-harness-ambient] canvas')).not.toBeNull()
    expect(document.querySelector('[data-dsh-harness-sidebar]')).toBeNull() // no stock seams in jsdom
    layer.setEnabled(false)
  })

  it('flipping off retracts the attribute, the token layer, and the ambient scene', () => {
    const { ctx, disposer } = make()
    const layer = new HarnessLayer(ctx)
    expect(document.querySelector('[data-dsh-harness-ambient]')).not.toBeNull()
    layer.setEnabled(false)
    expect(layer.getEnabled()).toBe(false)
    expect(document.documentElement.hasAttribute(HARNESS_ATTRIBUTE)).toBe(false)
    expect(disposer).toHaveBeenCalled() // token override disposer ran
    expect(document.querySelector('[data-dsh-harness-ambient]')).toBeNull()
    expect(localStorage.getItem(HARNESS_ENABLED_KEY)).toBe('false')
    // Re-enable re-mounts.
    layer.setEnabled(true)
    expect(document.documentElement.hasAttribute(HARNESS_ATTRIBUTE)).toBe(true)
    expect(document.querySelector('[data-dsh-harness-ambient]')).not.toBeNull()
    layer.setEnabled(false)
  })

  it('knobs clamp, persist, and drive the CSS variables', () => {
    const { ctx } = make()
    const layer = new HarnessLayer(ctx)
    layer.setBlur(999)
    expect(layer.getSettings().blur).toBe(40)
    expect(document.documentElement.style.getPropertyValue('--dsh-harness-blur')).toBe('40px')
    layer.setFrost(50)
    expect(layer.getSettings().frost).toBe(50)
    expect(document.documentElement.style.getPropertyValue('--dsh-harness-frost')).toBe('1')
    expect(localStorage.getItem('dsh.ui-harness.blur')).toBe('40')
    // Disabled: knobs persist but do not write the variables.
    layer.setEnabled(false)
    layer.setFrost(80)
    expect(document.documentElement.style.getPropertyValue('--dsh-harness-frost')).toBe('')
    layer.setEnabled(true)
    // Frost caps at 1.4x so max frost stays translucent frosted glass.
    expect(document.documentElement.style.getPropertyValue('--dsh-harness-frost')).toBe('1.4')
    layer.setEnabled(false)
  })

  it('a storage event from another tab flips the layer', () => {
    const { ctx } = make()
    const layer = new HarnessLayer(ctx)
    localStorage.setItem(HARNESS_ENABLED_KEY, 'false')
    window.dispatchEvent(new StorageEvent('storage', { key: HARNESS_ENABLED_KEY }))
    expect(layer.getEnabled()).toBe(false)
    expect(document.documentElement.hasAttribute(HARNESS_ATTRIBUTE)).toBe(false)
  })

  it('fiber dispose retracts everything without a reload', async () => {
    const { ctx, disposer } = make()
    new HarnessLayer(ctx)
    await ctx.fiber.dispose()
    expect(document.documentElement.hasAttribute(HARNESS_ATTRIBUTE)).toBe(false)
    expect(disposer).toHaveBeenCalled()
    expect(document.querySelector('[data-dsh-harness-ambient]')).toBeNull()
  })
})
