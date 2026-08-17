/**
 * Skills configuration tab: the configuration surface for project skills. Its
 * only job is configuring — one blank new-skill form — it does NOT display the
 * catalog (that is the list tab's job, styled like the plugin list). Saving
 * writes the skill file under `.dsh/skills` (frontmatter + body), where the
 * filesystem provider's watcher publishes the change immediately.
 */

import { useId, useState, type ReactNode } from 'react'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import css from './SkillsConfigTab.module.css'

/** One project skill file to create or replace. */
export interface SkillWriteInput {
  readonly name: string
  readonly description: string
  readonly whenToUse?: string
  readonly modelInvocable: boolean
  readonly content: string
}

/** Registration-side business face used by the tab. */
export interface SkillsConfigTabInjected {
  /** Create or replace one project skill file. */
  write: (skill: SkillWriteInput) => Promise<{ name: string }>
}

/** Full component props assembled by the Settings slot renderer. */
export type SkillsConfigTabProps =
  PropsRuntime<'settings.skills.tab'>
  & PropsLocale<'settings.skills'>
  & InjectFace<SkillsConfigTabInjected>

/** Editable draft backing the new-skill form. */
interface SkillDraft {
  name: string
  description: string
  whenToUse: string
  modelInvocable: boolean
  content: string
}

/** An empty draft for a brand-new skill. */
function emptyDraft(): SkillDraft {
  return { name: '', description: '', whenToUse: '', modelInvocable: true, content: '' }
}

/** Whether the draft has the required fields. */
function draftInvalid(draft: SkillDraft): boolean {
  return draft.name.trim() === '' || draft.description.trim() === ''
}

/** Render the project skill configuration form (blank; the catalog lives in the list). */
export function SkillsConfigTab({ write, t }: SkillsConfigTabProps): ReactNode {
  const formId = useId()
  const [draft, setDraft] = useState<SkillDraft>(emptyDraft())
  const [invalid, setInvalid] = useState(false)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const patch = (partial: Partial<SkillDraft>): void => {
    setDraft(current => ({ ...current, ...partial }))
    setNotice(null)
  }

  const submit = (): void => {
    if (draftInvalid(draft)) {
      setInvalid(true)
      return
    }
    setInvalid(false)
    setSaving(true)
    setNotice(null)
    void write({
      name: draft.name.trim(),
      description: draft.description.trim(),
      ...draft.whenToUse.trim() === '' ? {} : { whenToUse: draft.whenToUse.trim() },
      modelInvocable: draft.modelInvocable,
      content: draft.content,
    }).then(
      () => {
        setDraft(emptyDraft())
        setNotice(t('saved'))
        setSaving(false)
      },
      () => {
        setNotice(t('error'))
        setSaving(false)
      },
    )
  }

  return (
    <div className={css.section}>
      <div className={css.catalog}>
        {notice !== null ? <p className={css.notice} role="status">{notice}</p> : null}
        <div className={css.card} data-skill="new">
          <header className={css.cardHeader}>
            <strong className={css.cardTitle}>{t('newSkill')}</strong>
          </header>
          <div className={css.cardDetails}>
            <form className={css.form} onSubmit={(event) => { event.preventDefault(); submit() }}>
              <div className={css.field}>
                <label className={css.fieldLabel} htmlFor={`${formId}-name`}>{t('nameLabel')}</label>
                <input
                  id={`${formId}-name`}
                  className={css.fieldInput}
                  type="text"
                  value={draft.name}
                  onChange={(event) => { patch({ name: event.target.value }) }}
                />
              </div>
              <div className={css.field}>
                <label className={css.fieldLabel} htmlFor={`${formId}-description`}>{t('descriptionLabel')}</label>
                <input
                  id={`${formId}-description`}
                  className={css.fieldInput}
                  type="text"
                  value={draft.description}
                  onChange={(event) => { patch({ description: event.target.value }) }}
                />
              </div>
              <div className={css.field}>
                <label className={css.fieldLabel} htmlFor={`${formId}-when`}>{t('whenToUse')}</label>
                <input
                  id={`${formId}-when`}
                  className={css.fieldInput}
                  type="text"
                  value={draft.whenToUse}
                  onChange={(event) => { patch({ whenToUse: event.target.value }) }}
                />
              </div>
              <div className={css.checkboxRow}>
                <input
                  id={`${formId}-model`}
                  type="checkbox"
                  checked={draft.modelInvocable}
                  onChange={(event) => { patch({ modelInvocable: event.target.checked }) }}
                />
                <label htmlFor={`${formId}-model`}>{t('modelInvocableTag')}</label>
              </div>
              <div className={css.field}>
                <label className={css.fieldLabel} htmlFor={`${formId}-content`}>{t('contentLabel')}</label>
                <textarea
                  id={`${formId}-content`}
                  className={css.fieldTextarea}
                  rows={8}
                  value={draft.content}
                  onChange={(event) => { patch({ content: event.target.value }) }}
                />
              </div>
              {invalid ? <p className={css.invalid} role="alert">{t('invalidSkill')}</p> : null}
              <div className={css.actions}>
                <button type="submit" className={css.primaryButton} disabled={saving}>
                  {saving ? t('saving') : t('save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
