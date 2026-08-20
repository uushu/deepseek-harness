/**
 * Aqua theme selection section (`settings.section`, id 'theme', right below
 * General): two tabs mirroring the Plugins layout — `主题配置` (the active
 * theme's configuration) and `主题列表` (the selectable themes: the stock DSH
 * theme, Aqua, and the dynamic-wallpaper theme). The selection maps onto the
 * Aqua layer's enable flag + backdrop source; the stock theme's config is the
 * Appearance preference, while the Aqua / Wallpaper themes show the FULL glass
 * controls panel (shared with the General appearance row).
 */
import { useState } from 'react'
import type { InjectFace, PropsLocale, PropsRuntime, PropsStore } from '@deepseek-ai/dsh-client-ui-slots'
import type { ThemePreference } from '@deepseek-ai/dsh-client-ui-theme/client'
// Type-only: pulls the `settings.section` SlotMap merge.
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type { createAquaRowStore } from './settings-store.ts'
import { AquaControlsPanel, type AquaPanelSetters, type AquaPanelValues } from './AquaControlsPanel.tsx'
import css from './ThemeSection.module.css'

/** Injected business face: the layer's full setter surface plus the theme
 *  selection and the Appearance write. */
export interface ThemeSectionInjected extends AquaPanelSetters {
  /** Enable/disable the Aqua skin (theme selection). */
  setEnabled: (enabled: boolean) => void
  /** Switch the stock theme's Appearance preference. */
  setAppearance: (id: ThemePreference) => void
}

/** Full component props: runtime share + store share + locale seat + injected face. */
export type ThemeSectionComponentProps =
  PropsRuntime<'settings.section'> & PropsStore<ReturnType<typeof createAquaRowStore>>
  & PropsLocale<'settings.aqua'> & InjectFace<ThemeSectionInjected>

/** The theme list rows (id + locale name/description keys). */
const THEMES: readonly { id: 'stock' | 'aqua' | 'wallpaper'; nameKey: 'theme.stock.name' | 'theme.aqua.name' | 'theme.wallpaper.name'; descKey: 'theme.stock.desc' | 'theme.aqua.desc' | 'theme.wallpaper.desc' }[] = [
  { id: 'stock', nameKey: 'theme.stock.name', descKey: 'theme.stock.desc' },
  { id: 'aqua', nameKey: 'theme.aqua.name', descKey: 'theme.aqua.desc' },
  { id: 'wallpaper', nameKey: 'theme.wallpaper.name', descKey: 'theme.wallpaper.desc' },
]

/** Appearance preference options for the stock theme. */
const APPEARANCE: readonly { id: ThemePreference; labelKey: 'appearance.light' | 'appearance.dark' | 'appearance.system' }[] = [
  { id: 'light', labelKey: 'appearance.light' },
  { id: 'dark', labelKey: 'appearance.dark' },
  { id: 'system', labelKey: 'appearance.system' },
]

type TabId = 'config' | 'list'

/**
 * Render the Aqua theme page: tabs + the active panel.
 * @param props - composed slot props.
 * @returns the theme page element tree.
 */
export function ThemeSection(props: ThemeSectionComponentProps) {
  const { t, useStore, ...setters } = props
  const enabled = useStore(s => s.enabled)
  const background = useStore(s => s.background)
  const preference = useStore(s => s.preference)
  const [tab, setTab] = useState<TabId>('config')

  const selected = !enabled ? 'stock' : background === 'wallpaper' ? 'wallpaper' : 'aqua' as const

  const select = (id: 'stock' | 'aqua' | 'wallpaper'): void => {
    if (id === 'stock') {
      setters.setEnabled(false)
    } else if (id === 'wallpaper') {
      setters.setEnabled(true)
      setters.setBackground('wallpaper')
    } else {
      setters.setEnabled(true)
      setters.setBackground('fluid')
    }
  }

  const values: AquaPanelValues = {
    mode: useStore(s => s.mode),
    blur: useStore(s => s.blur),
    frost: useStore(s => s.frost),
    fluidHue: useStore(s => s.fluidHue),
    fluidDepth: useStore(s => s.fluidDepth),
    bgBrightness: useStore(s => s.bgBrightness),
    dark: useStore(s => s.dark),
    background,
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

  return (
    <div className={css.section}>
      <div className={css.tabs} role="tablist" aria-label={t('section.nav')}>
        <button
          type="button"
          role="tab"
          className={css.tab}
          aria-selected={tab === 'config'}
          data-active={tab === 'config' ? 'true' : undefined}
          onClick={() => { setTab('config') }}
        >
          {t('tab.config')}
        </button>
        <button
          type="button"
          role="tab"
          className={css.tab}
          aria-selected={tab === 'list'}
          data-active={tab === 'list' ? 'true' : undefined}
          onClick={() => { setTab('list') }}
        >
          {t('tab.list')}
        </button>
      </div>

      {tab === 'config' ? (
        <div className={css.page} role="tabpanel">
          {selected === 'stock' ? (
            <div className={css.appearance}>
              <div className={css.appearanceTitle}>{t('appearance.title')}</div>
              <div className={css.segmented}>
                {APPEARANCE.map(({ id, labelKey }) => (
                  <button
                    key={id}
                    type="button"
                    className={preference === id ? css.segActive : css.seg}
                    onClick={() => { setters.setAppearance(id) }}
                  >
                    {t(labelKey)}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <AquaControlsPanel values={values} setters={setters} t={t} />
          )}
        </div>
      ) : (
        <div className={css.page} role="tabpanel">
          <ul className={css.themeList}>
            {THEMES.map((row) => {
              const isSelected = row.id === selected
              return (
                <li key={row.id}>
                  <button
                    type="button"
                    className={`${css.themeRow}${isSelected ? ` ${css.themeRowActive}` : ''}`}
                    aria-pressed={isSelected}
                    onClick={() => { select(row.id) }}
                  >
                    <span className={css.themeText}>
                      <span className={css.themeName}>{t(row.nameKey)}</span>
                      <span className={css.themeDesc}>{t(row.descKey)}</span>
                    </span>
                    <span className={css.themeCheck}>{isSelected ? t('aqua.enable') : t('aqua.disable')}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
