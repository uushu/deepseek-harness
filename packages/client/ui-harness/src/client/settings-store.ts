/**
 * Harness skin slot store: a mirror of the layer state. The plugin's change
 * listeners are the only writers; the card/knobs read via props.useStore.
 */
import { defineStore, type EngineStoreHandle } from '@deepseek-ai/dsh-client-runtime/client'

/** Store state mirrored from the layer. */
export interface HarnessRowState {
  /** Whether the skin layer is enabled. */
  enabled: boolean
  /** Glass blur radius, px. */
  blur: number
  /** Glass fill amount, 0-100. */
  frost: number
  /** Layer revision; -1 until first sync so revision 0 lands as a change. */
  revision: number
}

/** Declared action shape giving the exported factory a stable return type. */
type HarnessRowActions = {
  sync: (draft: HarnessRowState, state: Omit<HarnessRowState, 'revision'>, revision: number) => void
}

/**
 * Declares the Harness settings row state and write surface.
 * @returns the store handle.
 */
export function createHarnessRowStore(): EngineStoreHandle<HarnessRowState, HarnessRowActions> {
  return defineStore({
    init: (): HarnessRowState => ({ enabled: true, blur: 20, frost: 60, revision: -1 }),
    actions: {
      sync: (d, state, revision) => {
        if (revision <= d.revision) return
        d.enabled = state.enabled
        d.blur = state.blur
        d.frost = state.frost
        d.revision = revision
      },
    },
  })
}
