/** Skills configuration tab: the skill catalog grouped by provider and source. */

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type { SkillEntry } from '@deepseek-ai/dsh-client-connection/client'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { SkillListResult } from './SkillsListTab.tsx'
import css from './SkillsConfigTab.module.css'

/** Registration-side business face used by the tab. */
export interface SkillsConfigTabInjected {
  /** Read the current session's project skill catalog. */
  list: () => Promise<SkillListResult>
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

/** Render where the current project's skills come from and who may invoke them. */
export function SkillsConfigTab({ list, t }: SkillsConfigTabProps): ReactNode {
  const [request, setRequest] = useState(0)
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
              <div className={css.catalog}>
                <div className={css.catalogHeading}>
                  <h3>{t('sources')}</h3>
                  <span data-skill-group-count={groups.length}>{groups.length}</span>
                </div>
                <ul className={css.groups}>
                  {groups.map(group => (
                    <li className={css.group} key={`${group.provider}\u0000${group.source}`}>
                      <header className={css.groupHeader}>
                        <span className={css.groupTitle}>
                          <strong>{group.provider}</strong>
                          <span className={css.sourceTag} data-source={group.source}>{group.source}</span>
                        </span>
                        <span className={css.groupCount} data-group-count={group.skills.length}>
                          {group.skills.length}
                        </span>
                      </header>
                      <ul className={css.skillList}>
                        {group.skills.map(skill => (
                          <li className={css.skillRow} key={skill.name} data-skill={skill.name}>
                            <span className={css.skillName}>{skill.name}</span>
                            <span
                              className={css.invocationTag}
                              data-model={skill.modelInvocable ? 'true' : 'false'}
                            >
                              {invocationLabel(skill, t)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              </div>
            )
      ) : null}
    </div>
  )
}
