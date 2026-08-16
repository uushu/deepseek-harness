/** Skills list tab: the current project's skill catalog with invocation badges. */

import { useEffect, useId, useState, type ReactNode } from 'react'
import type { SkillEntry } from '@deepseek-ai/dsh-client-connection/client'
import { IconChevronDownOutline14 } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import css from './SkillsListTab.module.css'

/** Read result of the session-addressed skill catalog. */
export interface SkillListResult {
  /** No session is open, so no project catalog can be addressed. */
  readonly sessionless: boolean
  readonly skills: readonly SkillEntry[]
}

/** Registration-side business face used by the tab. */
export interface SkillsListTabInjected {
  /** Read the current session's project skill catalog. */
  list: () => Promise<SkillListResult>
}

/** Full component props assembled by the Settings slot renderer. */
export type SkillsListTabProps =
  PropsRuntime<'settings.skills.tab'>
  & PropsLocale<'settings.skills'>
  & InjectFace<SkillsListTabInjected>

type ViewState =
  | { readonly status: 'loading' }
  | { readonly status: 'error' }
  | { readonly status: 'ready'; readonly result: SkillListResult }

/** Localized invocation badge for one skill entry. */
function invocationLabel(skill: SkillEntry, t: SkillsListTabProps['t']): string {
  return skill.modelInvocable ? t('modelInvocableTag') : t('userOnlyTag')
}

/** Render the user-invocable skill catalog for the current project. */
export function SkillsListTab({ list, t }: SkillsListTabProps): ReactNode {
  const catalogId = useId()
  const [request, setRequest] = useState(0)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [state, setState] = useState<ViewState>({ status: 'loading' })

  useEffect(() => {
    let current = true
    void Promise.resolve().then(() => list()).then(
      (result) => { if (current) setState({ status: 'ready', result }) },
      () => { if (current) setState({ status: 'error' }) },
    )
    return () => { current = false }
  }, [list, request])

  const retry = (): void => {
    setState({ status: 'loading' })
    setRequest(value => value + 1)
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
          : state.result.skills.length === 0
            ? <p className={css.status}>{t('empty')}</p>
            : (
              <ul className={css.cards}>
                {state.result.skills.map((skill) => {
                  const open = expanded === skill.name
                  const detailId = `${catalogId}-details-${encodeURIComponent(skill.name)}`
                  return (
                    <li
                      className={css.card}
                      key={skill.name}
                      data-skill={skill.name}
                      data-open={open ? 'true' : undefined}
                    >
                      <button
                        className={css.cardContent}
                        type="button"
                        aria-expanded={open}
                        aria-controls={detailId}
                        aria-label={`${skill.name}, ${invocationLabel(skill, t)}`}
                        onClick={() => {
                          setExpanded(current => current === skill.name ? null : skill.name)
                        }}
                      >
                        <span className={css.cardTitle}>
                          <strong>{skill.name}</strong>
                          <span className={css.description}>{skill.description}</span>
                        </span>
                        <span className={css.cardTrailing}>
                          <span
                            className={css.invocationTag}
                            data-model={skill.modelInvocable ? 'true' : 'false'}
                          >
                            {invocationLabel(skill, t)}
                          </span>
                          <IconChevronDownOutline14 className={css.chevron} size={12} aria-hidden="true" />
                        </span>
                      </button>
                      {open ? (
                        <div className={css.cardDetails} id={detailId}>
                          {skill.whenToUse !== undefined ? (
                            <p className={css.whenToUse}>
                              <span>{t('whenToUse')}</span>
                              {skill.whenToUse}
                            </p>
                          ) : null}
                          <dl className={css.details}>
                            <div>
                              <dt>{t('provider')}</dt>
                              <dd>{skill.provider}</dd>
                            </div>
                            <div>
                              <dt>{t('source')}</dt>
                              <dd>{skill.source}</dd>
                            </div>
                          </dl>
                        </div>
                      ) : null}
                    </li>
                  )
                })}
              </ul>
            )
      ) : null}
    </div>
  )
}
