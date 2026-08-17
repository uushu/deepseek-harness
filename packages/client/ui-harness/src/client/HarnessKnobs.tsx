/**
 * Harness skin knobs registered into the General settings section, directly
 * under the Appearance row (`settings.general.item`, order 11): the blur and
 * frost sliders. The card's master switch lives in the Plugins section; these
 * knobs only matter while the skin is enabled (the row hides with the plugin).
 */
import type { InjectFace, PropsLocale, PropsRuntime, PropsStore } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: pulls the `settings.general.item` SlotMap merge.
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type { createHarnessRowStore } from './settings-store.ts'
import css from './HarnessSettings.module.css'

/** Injected business face: the two glass knobs. */
export interface HarnessKnobsInjected {
  /** Set the glass blur radius, px. */
  setBlur: (value: number) => void
  /** Set the glass fill amount, 0-100. */
  setFrost: (value: number) => void
}

/** Full component props: runtime share + store share + locale seat + injected face. */
export type HarnessKnobsComponentProps =
  PropsRuntime<'settings.general.item'> & PropsStore<ReturnType<typeof createHarnessRowStore>>
  & PropsLocale<'settings.harness'> & InjectFace<HarnessKnobsInjected>

/**
 * Render the Harness skin knobs row.
 * @param props - composed slot props.
 * @returns the knob group element.
 */
export function HarnessKnobs(props: HarnessKnobsComponentProps) {
  const { t, setBlur, setFrost, useStore } = props
  const blur = useStore(s => s.blur)
  const frost = useStore(s => s.frost)
  return (
    <div className={css.group}>
      <div className={css.groupTitle}>{t('knobs.group')}</div>
      <label className={css.knob}>
        <span className={css.knobLabel}>{t('knobs.blur')}</span>
        <input
          type="range"
          className={css.range}
          min={0}
          max={40}
          value={blur}
          aria-label={t('knobs.blur')}
          onChange={(e) => { setBlur(Number(e.target.value)) }}
        />
        <span className={css.knobValue}>{blur}</span>
      </label>
      <label className={css.knob}>
        <span className={css.knobLabel}>{t('knobs.frost')}</span>
        <input
          type="range"
          className={css.range}
          min={0}
          max={100}
          value={frost}
          aria-label={t('knobs.frost')}
          onChange={(e) => { setFrost(Number(e.target.value)) }}
        />
        <span className={css.knobValue}>{frost}</span>
      </label>
    </div>
  )
}
