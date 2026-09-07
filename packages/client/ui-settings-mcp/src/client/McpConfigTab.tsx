/**
 * MCP configuration tab: the configuration surface for MCP servers. Its only
 * job is configuring — one blank new-server form — it does NOT display what is
 * already configured (that is the inventory tab's job, styled like the plugin
 * list). Saving upserts the server into the home-level user patch layer
 * (`$DSH_HOME/cordis.patch.yml`) where the config HMR picks it up; entering an
 * existing serverName replaces that server's config.
 */

import { useId, useState, type ReactNode } from 'react'
import type { McpServerConfigInput, McpServerView } from '@deepseek-ai/dsh-api-remotes/client'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import css from './McpConfigTab.module.css'

/** Registration-side Remote face used by the tab. */
export interface McpConfigTabInjected {
  /** Create or replace one MCP server in the user patch layer. */
  upsert: (config: McpServerConfigInput) => Promise<McpServerView>
}

/** Full component props assembled by the Settings slot renderer. */
export type McpConfigTabProps =
  PropsRuntime<'settings.mcp.tab'>
  & PropsLocale<'settings.mcp'>
  & InjectFace<McpConfigTabInjected>

/** One editable env/header row in the blank configuration form. */
interface SecretRow {
  key: string
  value: string
}

/** Editable server draft backing the form. */
export interface ServerDraft {
  serverName: string
  transport: 'stdio' | 'streamable-http'
  command: string
  args: string
  url: string
  cwd: string
  envRows: SecretRow[]
  headerRows: SecretRow[]
  toolCallTimeoutMs: string
  failOnStartupError: boolean
  reconnectEnabled: boolean
  initialDelayMs: string
  maxDelayMs: string
  maxAttempts: string
}

/** Localized transport label for one server draft. */
function transportLabel(transport: ServerDraft['transport'], t: McpConfigTabProps['t']): string {
  return transport === 'stdio' ? t('transportStdio') : t('transportHttp')
}

/** An empty draft for a brand-new server. */
export function emptyDraft(): ServerDraft {
  return {
    serverName: '',
    transport: 'stdio',
    command: '',
    args: '',
    url: '',
    cwd: '',
    envRows: [],
    headerRows: [],
    toolCallTimeoutMs: '',
    failOnStartupError: false,
    reconnectEnabled: false,
    initialDelayMs: '',
    maxDelayMs: '',
    maxAttempts: '',
  }
}

/** Convert rows into a string map, dropping blank keys. */
function rowsToMap(rows: readonly SecretRow[]): Record<string, string> | undefined {
  const map: Record<string, string> = {}
  for (const row of rows) {
    if (row.key.trim() === '') continue
    map[row.key.trim()] = row.value
  }
  return Object.keys(map).length === 0 ? undefined : map
}

/** Optional positive integer parsed from a text field. */
function optionalInt(text: string): number | undefined {
  const trimmed = text.trim()
  if (trimmed === '') return undefined
  const value = Number(trimmed)
  return Number.isFinite(value) && value > 0 ? value : undefined
}

/** Whether the draft has every required field for its transport. */
export function draftInvalid(draft: ServerDraft): boolean {
  if (draft.serverName.trim() === '') return true
  if (draft.transport === 'stdio') return draft.command.trim() === ''
  return draft.url.trim() === ''
}

/** Convert the draft into the wire config; optional fields are omitted when blank. */
export function draftToConfig(draft: ServerDraft): McpServerConfigInput {
  const timeout = optionalInt(draft.toolCallTimeoutMs)
  const initial = optionalInt(draft.initialDelayMs)
  const max = optionalInt(draft.maxDelayMs)
  const attempts = optionalInt(draft.maxAttempts)
  const shared = {
    ...(timeout === undefined ? {} : { toolCallTimeoutMs: timeout }),
    ...draft.failOnStartupError ? { failOnStartupError: true } : {},
    ...draft.reconnectEnabled
      ? {
        reconnect: {
          enabled: true,
          ...(initial === undefined ? {} : { initialDelayMs: initial }),
          ...(max === undefined ? {} : { maxDelayMs: max }),
          ...(attempts === undefined ? {} : { maxAttempts: attempts }),
        },
      }
      : {},
  }
  if (draft.transport === 'stdio') {
    const env = rowsToMap(draft.envRows)
    return {
      transport: 'stdio',
      serverName: draft.serverName.trim(),
      command: draft.command.trim(),
      ...draft.args.trim() === '' ? {} : { args: draft.args.split(',').map(arg => arg.trim()).filter(arg => arg !== '') },
      ...env === undefined ? {} : { env },
      ...draft.cwd.trim() === '' ? {} : { cwd: draft.cwd.trim() },
      ...shared,
    }
  }
  const headers = rowsToMap(draft.headerRows)
  return {
    transport: 'streamable-http',
    serverName: draft.serverName.trim(),
    url: draft.url.trim(),
    ...headers === undefined ? {} : { headers },
    ...shared,
  }
}

/** One editable field row inside the form. */
function Field(props: {
  id: string
  label: string
  value: string
  placeholder?: string
  numeric?: boolean
  onChange: (value: string) => void
}) {
  return (
    <div className={css.field}>
      <label className={css.fieldLabel} htmlFor={props.id}>{props.label}</label>
      <input
        id={props.id}
        className={css.fieldInput}
        type="text"
        inputMode={props.numeric === true ? 'numeric' : undefined}
        value={props.value}
        placeholder={props.placeholder ?? ''}
        onChange={(event) => { props.onChange(event.target.value) }}
      />
    </div>
  )
}

/** One checkbox row inside the form. */
function Checkbox(props: { id: string; label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <div className={css.checkboxRow}>
      <input
        id={props.id}
        type="checkbox"
        checked={props.checked}
        onChange={(event) => { props.onChange(event.target.checked) }}
      />
      <label htmlFor={props.id}>{props.label}</label>
    </div>
  )
}

/** The env/header secret map editor: key + value rows. */
function SecretRows(props: {
  rows: SecretRow[]
  onRows: (rows: SecretRow[]) => void
  addLabel: string
  removeLabel: string
}) {
  return (
    <div className={css.secretRows}>
      {props.rows.map((row, index) => (
        <div className={css.secretRow} key={`${index}-${row.key}`}>
          <input
            className={css.secretKey}
            type="text"
            value={row.key}
            aria-label="key"
            onChange={(event) => {
              const next = [...props.rows]
              next[index] = { ...row, key: event.target.value }
              props.onRows(next)
            }}
          />
          <input
            className={css.secretValue}
            type="password"
            autoComplete="off"
            value={row.value}
            onChange={(event) => {
              const next = [...props.rows]
              next[index] = { ...row, value: event.target.value }
              props.onRows(next)
            }}
          />
          <button
            type="button"
            className={css.rowButton}
            aria-label={props.removeLabel}
            onClick={() => { props.onRows(props.rows.filter((_, i) => i !== index)) }}
          >
            ✕
          </button>
        </div>
      ))}
      <button
        type="button"
        className={css.rowButton}
        onClick={() => { props.onRows([...props.rows, { key: '', value: '' }]) }}
      >
        {props.addLabel}
      </button>
    </div>
  )
}

/** Render the MCP server configuration form (blank; existing servers live in the list). */
export function McpConfigTab({ upsert, t }: McpConfigTabProps): ReactNode {
  const formId = useId()
  const [draft, setDraft] = useState<ServerDraft>(emptyDraft())
  const [invalid, setInvalid] = useState(false)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const patch = (partial: Partial<ServerDraft>): void => {
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
    void upsert(draftToConfig(draft)).then(
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
        <div className={css.card} data-mcp-server="new">
          <header className={css.cardHeader}>
            <strong className={css.cardTitle}>{t('newServer')}</strong>
            <span className={css.transportTag}>{transportLabel(draft.transport, t)}</span>
          </header>
          <form className={css.form} onSubmit={(event) => { event.preventDefault(); submit() }}>
            <Field
              id={`${formId}-name`}
              label={t('serverName')}
              value={draft.serverName}
              onChange={(value) => { patch({ serverName: value }) }}
            />
            <div className={css.transportRow}>
              {(['stdio', 'streamable-http'] as const).map(transport => (
                <label key={transport} className={css.transportOption}>
                  <input
                    type="radio"
                    name={`${formId}-transport`}
                    checked={draft.transport === transport}
                    onChange={() => { patch({ transport }) }}
                  />
                  {transport === 'stdio' ? t('transportStdio') : t('transportHttp')}
                </label>
              ))}
            </div>
            {draft.transport === 'stdio' ? (
              <>
                <Field id={`${formId}-command`} label={t('command')} value={draft.command} onChange={(value) => { patch({ command: value }) }} />
                <Field id={`${formId}-args`} label={t('args')} value={draft.args} onChange={(value) => { patch({ args: value }) }} />
                <Field id={`${formId}-cwd`} label={t('cwd')} value={draft.cwd} onChange={(value) => { patch({ cwd: value }) }} />
                <div className={css.field}>
                  <span className={css.fieldLabel}>{t('envKeys')}</span>
                  <SecretRows
                    rows={draft.envRows}
                    onRows={(envRows) => { patch({ envRows }) }}
                    addLabel={t('addRow')}
                    removeLabel={t('removeRow')}
                  />
                </div>
              </>
            ) : (
              <>
                <Field id={`${formId}-url`} label={t('url')} value={draft.url} onChange={(value) => { patch({ url: value }) }} />
                <div className={css.field}>
                  <span className={css.fieldLabel}>{t('headerKeys')}</span>
                  <SecretRows
                    rows={draft.headerRows}
                    onRows={(headerRows) => { patch({ headerRows }) }}
                    addLabel={t('addRow')}
                    removeLabel={t('removeRow')}
                  />
                </div>
              </>
            )}
            <Field
              id={`${formId}-timeout`}
              label={t('toolCallTimeoutMs')}
              value={draft.toolCallTimeoutMs}
              numeric
              onChange={(value) => { patch({ toolCallTimeoutMs: value }) }}
            />
            <Checkbox
              id={`${formId}-fail`}
              label={t('failOnStartupError')}
              checked={draft.failOnStartupError}
              onChange={(failOnStartupError) => { patch({ failOnStartupError }) }}
            />
            <Checkbox
              id={`${formId}-reconnect`}
              label={t('reconnect')}
              checked={draft.reconnectEnabled}
              onChange={(reconnectEnabled) => { patch({ reconnectEnabled }) }}
            />
            {draft.reconnectEnabled ? (
              <div className={css.reconnectDelays}>
                <span className={css.fieldLabel}>{t('reconnectDelays')}</span>
                <Field id={`${formId}-initial`} label={t('initialDelayMs')} value={draft.initialDelayMs} numeric onChange={(value) => { patch({ initialDelayMs: value }) }} />
                <Field id={`${formId}-max`} label={t('maxDelayMs')} value={draft.maxDelayMs} numeric onChange={(value) => { patch({ maxDelayMs: value }) }} />
                <Field id={`${formId}-attempts`} label={t('maxAttempts')} value={draft.maxAttempts} numeric onChange={(value) => { patch({ maxAttempts: value }) }} />
              </div>
            ) : null}
            {invalid ? <p className={css.invalid} role="alert">{t('invalidServer')}</p> : null}
            <div className={css.actions}>
              <button type="submit" className={css.primaryButton} disabled={saving}>
                {saving ? t('saving') : t('save')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
