/**
 * Harness plugin card registered into the Plugins settings section's
 * configurable tab (`settings.plugin.item`): the master on/off switch, in the
 * section's card language — flipping it off restores the stock UI exactly.
 */
import { IconCheckOutline16 } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime, PropsStore } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: pulls the `settings.plugin.item` SlotMap merge.
import type {} from '@deepseek-ai/dsh-client-ui-settings-plugins/client'
import type { createHarnessRowStore } from './settings-store.ts'
import css from './HarnessSettings.module.css'

/** Injected business face: the master enable write. */
export interface HarnessPluginCardInjected {
  /** Switch the skin layer on or off. */
  setEnabled: (enabled: boolean) => void
}

/** Full component props: runtime share + store share + locale seat + injected face. */
export type HarnessPluginCardComponentProps =
  PropsRuntime<'settings.plugin.item'> & PropsStore<ReturnType<typeof createHarnessRowStore>>
  & PropsLocale<'settings.harness'> & InjectFace<HarnessPluginCardInjected>

/**
 * Render the Harness plugin card.
 * @param props - composed slot props.
 * @returns the card list item.
 */
export function HarnessPluginCard(props: HarnessPluginCardComponentProps) {
  const { t, setEnabled, useStore } = props
  const enabled = useStore(s => s.enabled)
  return (
    <li className={css.card}>
      <div className={css.head}>
        <div className={css.text}>
          <div className={css.title}>{t('card.title')}</div>
          <div className={css.description}>{t('card.description')}</div>
        </div>
        <button
          type="button"
          className={css.toggle}
          aria-pressed={enabled}
          onClick={() => { setEnabled(!enabled) }}
        >
          <span>{enabled && <IconCheckOutline16 />}</span>
          {enabled ? t('on') : t('off')}
        </button>
      </div>
    </li>
  )
}
