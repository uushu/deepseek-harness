/** MCP configuration tab: one expandable card per configured server, redacted resolved config. */

import { useEffect, useId, useState, type ReactNode } from 'react'
import type { McpInventorySnapshot } from '@deepseek-ai/dsh-api-remotes/client'
import { IconChevronDownOutline14 } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { McpSettingsLocaleKey } from './locales.ts'
import css from './McpConfigTab.module.css'

/** Registration-side Remote face used by the tab. */
export interface McpConfigTabInjected {
  /** Read a current Host MCP server snapshot. */
  list: () => Promise<McpInventorySnapshot>
}

type McpServerView = McpInventorySnapshot['entries'][number]
type McpFiberPhase = McpServerView['fiberPhase']

/** Full component props assembled by the Settings slot renderer. */
export type McpConfigTabProps =
  PropsRuntime<'settings.mcp.tab'>
  & PropsLocale<'settings.mcp'>
  & InjectFace<McpConfigTabInjected>

type ViewState =
  | { readonly status: 'loading' }
  | { readonly status: 'error' }
  | { readonly status: 'ready'; readonly snapshot: McpInventorySnapshot }

const PHASE_KEYS = {
  pending: 'pending',
  loading: 'loadingPhase',
  active: 'active',
  failed: 'failed',
  unloading: 'unloading',
} satisfies Record<Exclude<McpFiberPhase, null>, McpSettingsLocaleKey>

/** Localized accessible label for one root Fiber phase. */
function phaseLabel(phase: McpFiberPhase, t: McpConfigTabProps['t']): string {
  return phase === null ? t('unobserved') : t(PHASE_KEYS[phase])
}

/** Localized transport label for one server view. */
function transportLabel(transport: McpServerView['transport'], t: McpConfigTabProps['t']): string {
  return transport === 'stdio' ? t('transportStdio') : t('transportHttp')
}

/** Ordered [label key, value] rows for the config fields present on a server view. */
function configRows(server: McpServerView, t: McpConfigTabProps['t']): Array<[McpSettingsLocaleKey, string]> {
  const rows: Array<[McpSettingsLocaleKey, string]> = []
  if (server.command !== undefined) rows.push(['command', server.command])
  if (server.args !== undefined && server.args.length > 0) rows.push(['args', server.args.join(' ')])
  if (server.url !== undefined) rows.push(['url', server.url])
  if (server.cwd !== undefined) rows.push(['cwd', server.cwd])
  if (server.envKeys !== undefined) rows.push(['envKeys', server.envKeys.join(', ')])
  if (server.headerKeys !== undefined) rows.push(['headerKeys', server.headerKeys.join(', ')])
  if (server.toolCallTimeoutMs !== undefined) rows.push(['toolCallTimeoutMs', String(server.toolCallTimeoutMs)])
  if (server.failOnStartupError !== undefined) {
    rows.push(['failOnStartupError', server.failOnStartupError ? t('enabledTag') : t('disabledTag')])
  }
  if (server.reconnect !== undefined) {
    rows.push(['reconnect', server.reconnect.enabled ? t('reconnect') : t('reconnectDisabled')])
    if (server.reconnect.enabled) {
      if (server.reconnect.initialDelayMs !== undefined) rows.push(['initialDelayMs', String(server.reconnect.initialDelayMs)])
      if (server.reconnect.maxDelayMs !== undefined) rows.push(['maxDelayMs', String(server.reconnect.maxDelayMs)])
      if (server.reconnect.maxAttempts !== undefined) rows.push(['maxAttempts', String(server.reconnect.maxAttempts)])
    }
  }
  return rows
}

/** Render the redacted config of every configured MCP server. */
export function McpConfigTab({ list, t }: McpConfigTabProps): ReactNode {
  const catalogId = useId()
  const [request, setRequest] = useState(0)
  const [expanded, setExpanded] = useState<McpServerView['entryId'] | null>(null)
  const [state, setState] = useState<ViewState>({ status: 'loading' })

  useEffect(() => {
    let current = true
    void Promise.resolve().then(() => list()).then(
      (snapshot) => { if (current) setState({ status: 'ready', snapshot }) },
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
        state.snapshot.entries.length === 0
          ? <p className={css.status}>{t('empty')}</p>
          : (
            <ul className={css.cards}>
              {state.snapshot.entries.map((server) => {
                const status = phaseLabel(server.fiberPhase, t)
                const title = server.serverName ?? t('unparsed')
                const configuration = t(server.enabled ? 'enabledTag' : 'disabledTag')
                const open = expanded === server.entryId
                const detailId = `${catalogId}-details-${encodeURIComponent(server.entryId)}`
                const rows = configRows(server, t)
                return (
                  <li
                    className={css.card}
                    key={server.entryId}
                    data-mcp-server={server.entryId}
                    data-open={open ? 'true' : undefined}
                  >
                    <button
                      className={css.cardContent}
                      type="button"
                      aria-expanded={open}
                      aria-controls={detailId}
                      aria-label={`${title}, ${server.transport === undefined ? '' : transportLabel(server.transport, t)}, ${configuration}`}
                      onClick={() => {
                        setExpanded(current => current === server.entryId ? null : server.entryId)
                      }}
                    >
                      <strong className={css.cardTitle} title={server.entryId}>{title}</strong>
                      <span className={css.cardTrailing}>
                        {server.transport !== undefined
                          ? <span className={css.transportTag}>{transportLabel(server.transport, t)}</span>
                          : null}
                        {server.enabled ? (
                          <span
                            className={css.statusDot}
                            data-phase={server.fiberPhase ?? 'unobserved'}
                            role="img"
                            aria-label={status}
                            title={status}
                          />
                        ) : null}
                        <span className={css.configTag} data-enabled={server.enabled ? 'true' : 'false'}>
                          {configuration}
                        </span>
                        <IconChevronDownOutline14 className={css.chevron} size={12} aria-hidden="true" />
                      </span>
                    </button>
                    {open ? (
                      <div className={css.cardDetails} id={detailId}>
                        <code className={css.entryValue} data-loader-entry>{server.entryId}</code>
                        <dl className={css.details}>
                          <div>
                            <dt>{t('configuration')}</dt>
                            <dd>{configuration}</dd>
                          </div>
                          {server.enabled ? (
                            <div>
                              <dt>{t('cordis')}</dt>
                              <dd>{status}</dd>
                            </div>
                          ) : null}
                          {rows.map(([key, value]) => (
                            <div key={key}>
                              <dt>{t(key)}</dt>
                              <dd>{value}</dd>
                            </div>
                          ))}
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
