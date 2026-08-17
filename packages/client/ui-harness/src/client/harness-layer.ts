/**
 * Harness skin layer: one toggleable visual skin over the whole Web surface.
 * Everything this layer owns is an effect — token overrides ride the theme
 * service's override stack, the CSS hooks ride a `data-dsh-harness` attribute
 * on <html> (the stylesheet only applies under it), the ambient scene and the
 * surface seams are mounted/removed with the layer — so flipping the flag off
 * (or unloading the plugin) restores the stock UI exactly: no residue, no
 * reload.
 *
 * The enable flag and the two knobs persist in localStorage: a client-only
 * visual preference (like the selected-session key), written and read by this
 * plugin alone.
 * @module @deepseek-ai/dsh-client-ui-harness
 */
import type { Context } from '@deepseek-ai/cordis'
import type { ThemeTokenOverrides } from '@deepseek-ai/dsh-client-ui-theme/client'
import { HARNESS_TOKEN_OVERRIDES } from './harness-tokens.ts'
import { ParticleField } from './particles.ts'
import { startSeamStamper } from './seam-stamper.ts'

/** html attribute selecting the Harness layer: CSS hooks and ambient effects. */
export const HARNESS_ATTRIBUTE = 'data-dsh-harness'

/** localStorage key carrying the layer enable flag. */
export const HARNESS_ENABLED_KEY = 'dsh.ui-harness.enabled'

/** localStorage keys for the knobs. */
const BLUR_KEY = 'dsh.ui-harness.blur'
const FROST_KEY = 'dsh.ui-harness.frost'

/** Default state when nothing is stored yet: on (the shipped look). */
export const DEFAULT_ENABLED = true

/** Default knob values. */
const DEFAULT_BLUR = 20
const DEFAULT_FROST = 60

/** The layer's identity in the theme override stack (inspection-visible). */
const OVERRIDE_SOURCE = '@deepseek-ai/dsh-client-ui-harness'

/** Knob state exposed to the settings row. */
export interface HarnessSettings {
  /** Glass backdrop blur radius, px (0-40). */
  blur: number
  /** Glass fill, 0-100 (50 = the shipped look; drives the frost multiplier). */
  frost: number
}

const clamp = (value: number, max: number, fallback: number): number =>
  Number.isFinite(value) ? Math.min(max, Math.max(0, value)) : fallback

function readEnabled(): boolean {
  try {
    const raw = localStorage.getItem(HARNESS_ENABLED_KEY)
    return raw === null ? DEFAULT_ENABLED : raw === 'true'
  } catch {
    return DEFAULT_ENABLED
  }
}

function readBlur(): number {
  try {
    const raw = localStorage.getItem(BLUR_KEY)
    return raw === null ? DEFAULT_BLUR : clamp(Number(raw), 40, DEFAULT_BLUR)
  } catch {
    return DEFAULT_BLUR
  }
}

function readFrost(): number {
  try {
    const raw = localStorage.getItem(FROST_KEY)
    return raw === null ? DEFAULT_FROST : clamp(Number(raw), 100, DEFAULT_FROST)
  } catch {
    return DEFAULT_FROST
  }
}

/** Ambient scene: the fixed deep-sea backdrop + the particle fabric. */
function ensureAmbientScene(): HTMLElement {
  const existing = document.querySelector<HTMLElement>('[data-dsh-harness-ambient]')
  if (existing !== null) return existing
  const ambient = document.createElement('div')
  ambient.setAttribute('data-dsh-harness-ambient', '')
  ambient.setAttribute('aria-hidden', 'true')
  document.body.appendChild(ambient)
  return ambient
}

/**
 * Owns the Harness layer lifecycle: reads the durable enable flag, applies or
 * retracts every layer on change, and releases everything when the plugin
 * fiber is disposed. Cross-tab flips arrive through the storage event.
 */
export class HarnessLayer {
  private enabled = false
  private blur = DEFAULT_BLUR
  private frost = DEFAULT_FROST
  private tokenDisposer: (() => void) | undefined
  private seamDisposer: (() => void) | undefined
  private particles: ParticleField | undefined
  private ambient: HTMLElement | undefined

  /**
   * @param ctx - owning client context (its fiber dispose releases the layer).
   */
  constructor(private readonly ctx: Context) {
    ctx.effect(() => {
      const onStorage = (event: StorageEvent): void => {
        if (event.key === HARNESS_ENABLED_KEY) {
          this.enabled = readEnabled()
          this.sync()
        } else if (event.key === BLUR_KEY || event.key === FROST_KEY) {
          this.reloadKnobs()
          if (this.enabled) this.applySettings()
        }
      }
      window.addEventListener('storage', onStorage)
      return () => {
        window.removeEventListener('storage', onStorage)
        this.unmount()
      }
    }, 'ui-harness: layer lifecycle')
    this.enabled = readEnabled()
    this.blur = readBlur()
    this.frost = readFrost()
    this.sync()
  }

  /** Current enable state (the settings card mirrors this). */
  getEnabled(): boolean {
    return this.enabled
  }

  /** Current knob values (the settings row mirrors these). */
  getSettings(): HarnessSettings {
    return { blur: this.blur, frost: this.frost }
  }

  /** Flip the layer: persist, then apply or retract every owned effect. */
  setEnabled(value: boolean): void {
    if (value === this.enabled) return
    this.enabled = value
    try { localStorage.setItem(HARNESS_ENABLED_KEY, String(value)) } catch { /* in-memory only */ }
    this.sync()
  }

  /** Set the glass blur radius (px, 0-40). */
  setBlur(value: number): void {
    const next = clamp(value, 40, DEFAULT_BLUR)
    if (next === this.blur) return
    this.blur = next
    try { localStorage.setItem(BLUR_KEY, String(next)) } catch { /* in-memory only */ }
    if (this.enabled) this.applySettings()
  }

  /** Set the glass fill amount (0-100, 50 = shipped). */
  setFrost(value: number): void {
    const next = clamp(value, 100, DEFAULT_FROST)
    if (next === this.frost) return
    this.frost = next
    try { localStorage.setItem(FROST_KEY, String(next)) } catch { /* in-memory only */ }
    if (this.enabled) this.applySettings()
  }

  private reloadKnobs(): void {
    this.blur = readBlur()
    this.frost = readFrost()
  }

  private sync(): void {
    if (this.enabled) this.mount()
    else this.unmount()
  }

  /** Write the knob-driven CSS variables onto <html>. */
  private applySettings(): void {
    const style = document.documentElement.style
    style.setProperty('--dsh-harness-blur', `${this.blur}px`)
    // Frost 0-100 → a 0-1.4 alpha multiplier (50 = 1x).
    style.setProperty('--dsh-harness-frost', String(Math.min(this.frost / 50, 1.4)))
  }

  private mount(): void {
    document.documentElement.setAttribute(HARNESS_ATTRIBUTE, '')
    this.applySettings()
    this.tokenDisposer?.()
    this.tokenDisposer = this.ctx.theme.overrideTokens(
      OVERRIDE_SOURCE,
      HARNESS_TOKEN_OVERRIDES as ThemeTokenOverrides,
    )
    this.ambient = ensureAmbientScene()
    this.particles?.dispose()
    this.particles = new ParticleField(this.ambient)
    if (this.seamDisposer === undefined) this.seamDisposer = startSeamStamper()
  }

  private unmount(): void {
    document.documentElement.removeAttribute(HARNESS_ATTRIBUTE)
    document.documentElement.style.removeProperty('--dsh-harness-blur')
    document.documentElement.style.removeProperty('--dsh-harness-frost')
    this.tokenDisposer?.()
    this.tokenDisposer = undefined
    this.particles?.dispose()
    this.particles = undefined
    this.ambient?.remove()
    this.ambient = undefined
    this.seamDisposer?.()
    this.seamDisposer = undefined
  }
}
