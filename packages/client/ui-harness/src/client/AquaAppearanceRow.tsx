/**
 * Aqua appearance row registered into the General section item slot: the shared
 * full controls panel. The row renders nothing while the master switch is off.
 */
import type { PropsLocale, PropsRuntime, PropsStore } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: pulls the `settings.general.item` SlotMap merge.
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type { createAquaRowStore } from './settings-store.ts'
import { AquaControlsPanel, type AquaPanelSetters, type AquaPanelValues } from './AquaControlsPanel.tsx'

/** Injected business face: the layer's full setter surface. */
export interface AquaAppearanceRowInjected extends AquaPanelSetters {}

/** Full component props: runtime share + store share + locale seat + injected face. */
export type AquaAppearanceRowComponentProps =
  PropsRuntime<'settings.general.item'> & PropsStore<ReturnType<typeof createAquaRowStore>>
  & PropsLocale<'settings.aqua'> & AquaAppearanceRowInjected

/**
 * Render the Aqua appearance row (the full controls panel).
 * @param props - composed slot props.
 * @returns the General section row, or nothing while the skin is off.
 */
export function AquaAppearanceRow(props: AquaAppearanceRowComponentProps) {
  const { t, useStore, ...setters } = props
  const enabled = useStore(s => s.enabled)
  if (!enabled) return null
  const values: AquaPanelValues = {
    mode: useStore(s => s.mode),
    blur: useStore(s => s.blur),
    frost: useStore(s => s.frost),
    fluidHue: useStore(s => s.fluidHue),
    fluidDepth: useStore(s => s.fluidDepth),
    bgBrightness: useStore(s => s.bgBrightness),
    dark: useStore(s => s.dark),
    background: useStore(s => s.background),
    whale: useStore(s => s.whale),
    critters: useStore(s => s.critters),
    mesh: useStore(s => s.mesh),
    spotlight: useStore(s => s.spotlight),
    press: useStore(s => s.press),
    wallpaper: useStore(s => s.wallpaper),
    wallpaperBlur: useStore(s => s.wallpaperBlur),
    wallpaperFrost: useStore(s => s.wallpaperFrost),
    videoBlur: useStore(s => s.videoBlur),
    videoBrightness: useStore(s => s.videoBrightness),
  }
  return <AquaControlsPanel values={values} setters={setters} t={t} />
}
