/**
 * Personalization settings page: the user's personalization instruction list.
 * One large editor box, one instruction per line; the whole text saves as the
 * `personalization.instructions` settings value (the GUI editor for the same
 * rules the specs carry).
 */

import { useEffect, useState } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import css from './PersonalizationSection.module.css'

/** Injected actions: the settings wire face behind this page. */
export interface PersonalizationSectionInjected {
  /** Load the stored instruction list. */
  load(): Promise<string[]>
  /** Replace the stored instruction list. */
  save(instructions: string[]): Promise<void>
}

/** Full component props: injected actions plus the locale seat. */
export type PersonalizationSectionProps =
  PropsLocale<'settings'>
  & InjectFace<PersonalizationSectionInjected>

/**
 * Render the personalization instructions settings page.
 * @param props - injected load/save actions and the locale seat.
 */
export function PersonalizationSection({ t, load, save }: PersonalizationSectionProps) {
  const [value, setValue] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    setBusy(true)
    void load().then((list) => {
      if (!alive) return
      setValue(list.join('\n'))
      setError(null)
    }).catch((reason: unknown) => {
      if (!alive) return
      setValue('')
      setError(reason instanceof Error ? reason.message : String(reason))
    }).finally(() => {
      if (alive) setBusy(false)
    })
    return () => { alive = false }
  }, [load])

  const saveDraft = async (): Promise<void> => {
    const next = (value ?? '').split('\n').map(line => line.trim()).filter(line => line !== '')
    setBusy(true)
    setNotice(null)
    setError(null)
    try {
      await save(next)
      setValue(next.join('\n'))
      setNotice(t('personalization.saved'))
    } catch (reason: unknown) {
      setError(t('personalization.saveFailed', {
        error: reason instanceof Error ? reason.message : String(reason),
      }))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={css.section}>
      <h2 className={css.heading}>{t('personalization.title')}</h2>
      <p className={css.intro}>{t('personalization.desc')}</p>

      {notice !== null && <div className={css.notice} role="status">{notice}</div>}
      {error !== null && <div className={css.error} role="alert">{error}</div>}

      {value === null ? (
        <p className={css.empty}>{t('personalization.loading')}</p>
      ) : (
        <>
          <textarea
            className={css.editor}
            value={value}
            disabled={busy}
            placeholder={t('personalization.placeholder')}
            onChange={(event) => { setValue(event.target.value) }}
          />
          <div className={css.actions}>
            <Button
              variant="primary"
              size="sm"
              disabled={busy}
              onClick={() => { void saveDraft() }}
            >
              {busy ? t('personalization.saving') : t('personalization.save')}
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
