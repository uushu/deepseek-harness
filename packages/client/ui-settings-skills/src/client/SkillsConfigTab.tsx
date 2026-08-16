/**
 * Skills configuration tab: the current project's skills as expandable cards
 * with an editable form. Saving writes the skill file under `.dsh/skills`
 * (frontmatter + body), where the filesystem provider's watcher publishes the
 * change immediately; deleting removes the file.
 */

import { useEffect, useId, useMemo, useState, type ReactNode } from 'react'
import type { SkillEntry } from '@deepseek-ai/dsh-client-connection/client'
import { IconChevronDownOutline14, IconPlusOutline16 } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { SkillListResult } from './SkillsListTab.tsx'
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
  /** Read the current session's project skill catalog. */
  list: () => Promise<SkillListResult>
  /** Read one project skill file's markdown body. */
  read: (name: string) => Promise<string>
  /** Create or replace one project skill file. */
  write: (skill: SkillWriteInput) => Promise<{ name: string }>
  /** Remove one project skill file. */
  remove: (name: string) => Promise<{ removed: boolean }>
}

/** Full component props assembled by the Settings slot renderer. */
export type SkillsConfigTabProps =
  PropsRuntime<'settings.skills.tab'>
  & PropsLocale<'settings.skills'>
  & InjectFace<SkillsConfigTabInjected>

type ViewState =
  | { readonly status: 'loading' }
  | { readonly status: 'error' }
  | { readonly status: 'ready'; readonly result: SkillListResult }

/** One (provider, source) group of skills. */
export interface SkillSourceGroup {
  readonly provider: string
  readonly source: string
  readonly skills: readonly SkillEntry[]
}

/** Mutable accumulation shape kept internal to the grouping. */
interface MutableSourceGroup {
  provider: string
  source: string
  skills: SkillEntry[]
}

/** Group skills by their provider/source pair, ordered by provider then source. */
export function groupSkills(skills: readonly SkillEntry[]): SkillSourceGroup[] {
  const groups = new Map<string, MutableSourceGroup>()
  for (const skill of skills) {
    const key = `${skill.provider}\u0000${skill.source}`
    const existing = groups.get(key)
    if (existing === undefined) {
      groups.set(key, { provider: skill.provider, source: skill.source, skills: [skill] })
    } else {
      existing.skills.push(skill)
    }
  }
  return [...groups.values()]
    .sort((a, b) => a.provider.localeCompare(b.provider) || a.source.localeCompare(b.source))
}

/** Localized invocation badge for one skill entry. */
function invocationLabel(skill: SkillEntry, t: SkillsConfigTabProps['t']): string {
  return skill.modelInvocable ? t('modelInvocableTag') : t('userOnlyTag')
}

/** Editable draft backing one skill form. */
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

/** Draft for one existing skill; the body is filled after `read` settles. */
function draftFromEntry(skill: SkillEntry): SkillDraft {
  return {
    name: skill.name,
    description: skill.description,
    whenToUse: skill.whenToUse ?? '',
    modelInvocable: skill.modelInvocable,
    content: '',
  }
}

/** Whether the draft has the required fields. */
function draftInvalid(draft: SkillDraft): boolean {
  return draft.name.trim() === '' || draft.description.trim() === ''
}

/** One expandable skill card with its edit form. */
function SkillCard(props: {
  skill: SkillEntry | undefined
  open: boolean
  detailId: string
  saving: boolean
  bodyLoading: boolean
  /** Loaded markdown body; undefined while loading or for a new skill. */
  body: string | undefined
  t: SkillsConfigTabProps['t']
  onToggle: () => void
  onSave: (draft: SkillDraft) => void
  onDelete: () => void
}) {
  const { skill, open, t } = props
  const [draft, setDraft] = useState<SkillDraft>(skill === undefined ? emptyDraft() : draftFromEntry(skill))
  const [invalid, setInvalid] = useState(false)
  const title = skill?.name ?? t('addSkill')

  // The body arrives asynchronously after expand; the textarea is hidden
  // until then, so filling the draft cannot clobber user input.
  const loadedBody = props.body
  useEffect(() => {
    if (skill !== undefined && loadedBody !== undefined) {
      setDraft(current => ({ ...current, content: loadedBody }))
    }
  }, [loadedBody])

  if (!open) {
    return (
      /* v8 ignore next -- the section never renders the new-skill card collapsed */
      <li className={css.card} data-skill={skill?.name ?? 'new'} data-open="false">
        <button
          type="button"
          className={css.cardContent}
          aria-expanded="false"
          aria-controls={props.detailId}
          /* v8 ignore next -- the section never renders the new-skill card collapsed */
          aria-label={skill === undefined ? title : `${title}, ${invocationLabel(skill, t)}`}
          onClick={props.onToggle}
        >
          <span className={css.cardTitle}>
            <strong>{title}</strong>
            {/* v8 ignore next -- the new-skill card shows no description */}
            {skill !== undefined ? <span className={css.description}>{skill.description}</span> : null}
          </span>
          <span className={css.cardTrailing}>
            {skill !== undefined ? (
              <span className={css.invocationTag} data-model={skill.modelInvocable ? 'true' : 'false'}>
                {invocationLabel(skill, t)}
              </span>
              /* v8 ignore next -- the new-skill card shows no invocation tag */
            ) : null}
            <IconChevronDownOutline14 className={css.chevron} size={12} aria-hidden="true" />
          </span>
        </button>
      </li>
    )
  }

  const patch = (partial: Partial<SkillDraft>): void => {
    setDraft(current => ({ ...current, ...partial }))
  }

  const submit = (): void => {
    if (draftInvalid(draft)) {
      setInvalid(true)
      return
    }
    setInvalid(false)
    props.onSave(draft)
  }

  return (
    <li className={css.card} data-skill={skill?.name ?? 'new'} data-open="true">
      <button
        type="button"
        className={css.cardContent}
        aria-expanded="true"
        aria-controls={props.detailId}
        aria-label={skill === undefined ? title : `${title}, ${invocationLabel(skill, t)}`}
        onClick={props.onToggle}
      >
        <span className={css.cardTitle}>
          <strong>{title}</strong>
          {skill !== undefined ? <span className={css.description}>{skill.description}</span> : null}
        </span>
        <IconChevronDownOutline14 className={css.chevron} size={12} aria-hidden="true" />
      </button>
      <div className={css.cardDetails} id={props.detailId}>
        <form className={css.form} onSubmit={(event) => { event.preventDefault(); submit() }}>
          <div className={css.field}>
            <label className={css.fieldLabel} htmlFor={`${props.detailId}-name`}>{t('nameLabel')}</label>
            <input
              id={`${props.detailId}-name`}
              className={css.fieldInput}
              type="text"
              value={draft.name}
              disabled={skill !== undefined}
              onChange={(event) => { patch({ name: event.target.value }) }}
            />
          </div>
          <div className={css.field}>
            <label className={css.fieldLabel} htmlFor={`${props.detailId}-description`}>{t('descriptionLabel')}</label>
            <input
              id={`${props.detailId}-description`}
              className={css.fieldInput}
              type="text"
              value={draft.description}
              onChange={(event) => { patch({ description: event.target.value }) }}
            />
          </div>
          <div className={css.field}>
            <label className={css.fieldLabel} htmlFor={`${props.detailId}-when`}>{t('whenToUse')}</label>
            <input
              id={`${props.detailId}-when`}
              className={css.fieldInput}
              type="text"
              value={draft.whenToUse}
              onChange={(event) => { patch({ whenToUse: event.target.value }) }}
            />
          </div>
          <div className={css.checkboxRow}>
            <input
              id={`${props.detailId}-model`}
              type="checkbox"
              checked={draft.modelInvocable}
              onChange={(event) => { patch({ modelInvocable: event.target.checked }) }}
            />
            <label htmlFor={`${props.detailId}-model`}>{t('modelInvocableTag')}</label>
          </div>
          <div className={css.field}>
            <label className={css.fieldLabel} htmlFor={`${props.detailId}-content`}>{t('contentLabel')}</label>
            {props.bodyLoading
              ? <p className={css.status}>{t('loadingBody')}</p>
              : (
                <textarea
                  id={`${props.detailId}-content`}
                  className={css.fieldTextarea}
                  rows={8}
                  value={draft.content}
                  onChange={(event) => { patch({ content: event.target.value }) }}
                />
              )}
          </div>
          {invalid ? <p className={css.invalid} role="alert">{t('invalidSkill')}</p> : null}
          <div className={css.actions}>
            <button type="submit" className={css.primaryButton} disabled={props.saving}>
              {props.saving ? t('saving') : t('save')}
            </button>
            {skill !== undefined ? (
              <button type="button" className={css.dangerButton} disabled={props.saving} onClick={props.onDelete}>
                {t('deleteSkill')}
              </button>
            ) : null}
            <button type="button" className={css.secondaryButton} disabled={props.saving} onClick={props.onToggle}>
              {t('cancel')}
            </button>
          </div>
          {skill !== undefined ? <p className={css.deleteHint}>{t('deleteHint')}</p> : null}
        </form>
      </div>
    </li>
  )
}

/** Render the editable project skill configuration. */
export function SkillsConfigTab({ list, read, write, remove, t }: SkillsConfigTabProps): ReactNode {
  const catalogId = useId()
  const [request, setRequest] = useState(0)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [bodyLoading, setBodyLoading] = useState(false)
  const [bodies, setBodies] = useState<Record<string, string | undefined>>({})
  const [notice, setNotice] = useState<string | null>(null)
  const [state, setState] = useState<ViewState>({ status: 'loading' })

  useEffect(() => {
    let current = true
    void Promise.resolve().then(() => list()).then(
      (result) => { if (current) setState({ status: 'ready', result }) },
      () => { if (current) setState({ status: 'error' }) },
    )
    return () => { current = false }
  }, [list, request])

  const groups = useMemo(
    () => state.status === 'ready' ? groupSkills(state.result.skills) : [],
    [state],
  )

  const refresh = (): void => {
    setState({ status: 'loading' })
    setRequest(value => value + 1)
  }

  const retry = (): void => {
    setNotice(null)
    refresh()
  }

  const toggle = (key: string): void => {
    setExpanded(current => current === key ? null : key)
    setNotice(null)
    if (key !== 'new' && bodies[key] === undefined) {
      setBodyLoading(true)
      void read(key).then(
        (content) => {
          setBodies(current => ({ ...current, [key]: content }))
          setBodyLoading(false)
        },
        () => { setBodyLoading(false) },
      )
    }
  }

  const saveDraft = async (draft: SkillDraft): Promise<void> => {
    setSaving(true)
    setNotice(null)
    try {
      await write({
        name: draft.name.trim(),
        description: draft.description.trim(),
        ...draft.whenToUse.trim() === '' ? {} : { whenToUse: draft.whenToUse.trim() },
        modelInvocable: draft.modelInvocable,
        content: draft.content,
      })
      setNotice(t('saved'))
      setExpanded(null)
      refresh()
    } finally {
      setSaving(false)
    }
  }

  const deleteSkill = async (name: string): Promise<void> => {
    setSaving(true)
    setNotice(null)
    try {
      await remove(name)
      setExpanded(null)
      refresh()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={css.section} aria-busy={state.status === 'loading'}>
      {state.status === 'loading' ? <p className={css.status}>{t('loading')}</p> : null}
      {state.status === 'error' ? (
        <div className={css.failure}>
          <p role="alert">{t('error')}</p>
          <button type="button" onClick={retry}>{t('retry')}</button>
        </div>
      ) : null}
      {state.status === 'ready' ? (
        state.result.sessionless
          ? <p className={css.status}>{t('noSession')}</p>
          : (
            <div className={css.catalog}>
              {notice !== null ? <p className={css.notice} role="status">{notice}</p> : null}
              <button type="button" className={css.addButton} onClick={() => { toggle('new') }}>
                <IconPlusOutline16 size={14} aria-hidden="true" />
                {t('addSkill')}
              </button>
              {state.result.skills.length === 0 && expanded !== 'new'
                ? <p className={css.status}>{t('empty')}</p>
                : null}
              {expanded === 'new' ? (
                <ul className={css.cards}>
                  <SkillCard
                    skill={undefined}
                    open
                    detailId={`${catalogId}-new`}
                    saving={saving}
                    bodyLoading={false}
                    body={undefined}
                    t={t}
                    onToggle={() => { toggle('new') }}
                    onSave={(draft) => { void saveDraft(draft) }}
                    /* v8 ignore next -- the new-skill card renders no delete button */
                    onDelete={() => {}}
                  />
                </ul>
              ) : null}
              {groups.map(group => (
                <div className={css.group} key={`${group.provider}\u0000${group.source}`}>
                  <header className={css.groupHeader}>
                    <span className={css.groupTitle}>
                      <strong>{group.provider}</strong>
                      <span className={css.sourceTag}>{group.source}</span>
                    </span>
                    <span className={css.groupCount}>{group.skills.length}</span>
                  </header>
                  <ul className={css.cards}>
                    {group.skills.map((skill) => {
                      const open = expanded === skill.name
                      return (
                        <SkillCard
                          key={skill.name}
                          skill={skill}
                          open={open}
                          detailId={`${catalogId}-details-${encodeURIComponent(skill.name)}`}
                          saving={saving}
                          bodyLoading={open && bodyLoading}
                          body={open ? bodies[skill.name] : undefined}
                          t={t}
                          onToggle={() => { toggle(skill.name) }}
                          onSave={(draft) => { void saveDraft(draft) }}
                          onDelete={() => { void deleteSkill(skill.name) }}
                        />
                      )
                    })}
                  </ul>
                </div>
              ))}
            </div>
          )
      ) : null}
    </div>
  )
}
