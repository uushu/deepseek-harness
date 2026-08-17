/**
 * MCP configuration tab: the configured servers from the home-level user patch
 * layer (`$DSH_HOME/cordis.patch.yml`), each shown as an always-open editable
 * form, plus a new-server form at the end — no add-click, no collapse, and no
 * duplication of the live-instance list (that is the inventory tab's job).
 * Saving upserts the server into the patch layer where the config HMR picks it
 * up; deleting (through the `removeServer` Remote, renamed from `remove` to
 * avoid the typert namespace collision) unloads its tools.
 */

import { useEffect, useId, useState, type ReactNode } from 'react'
import type { McpInventorySnapshot, McpServerConfigInput } from '@deepseek-ai/dsh-api-remotes/client'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import css from './McpConfigTab.module.css'

/** Registration-side Remote face used by the tab. */
export interface McpConfigTabInjected {
  /** Read the configured servers from the user patch layer (no loader state). */
  listConfig: () => Promise<McpInventorySnapshot>
  /** Create or replace one MCP server in the user patch layer. */
  upsert: (config: McpServerConfigInput) => Promise<McpInventorySnapshot['entries'][number]>
  /** Remove one MCP server from the user patch layer. */
  removeServer: (serverName: string) => Promise<{ removed: boolean }>
}

type McpServerView = McpInventorySnapshot['entries'][number]

/** Full component props assembled by the Settings slot renderer. */
export type McpConfigTabProps =
  PropsRuntime<'settings.mcp.tab'>
  & PropsLocale<'settings.mcp'>
  & InjectFace<McpConfigTabInjected>

type ViewState =
  | { readonly status: 'loading' }
  | { readonly status: 'error' }
  | { readonly status: 'ready'; readonly snapshot: McpInventorySnapshot }

/** One editable env/header row; `configured` marks a key with a stored value. */
interface SecretRow {
  key: string
  value: string
  configured: boolean
}

/** Editable server draft backing one server form. */
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

/** Localized transport label for one server view. */
function transportLabel(transport: McpServerView['transport'], t: McpConfigTabProps['t']): string {
  return transport === 'stdio' ? t('transportStdio') : t('transportHttp')
}

/** Build the edit draft for one server view (secrets redacted, keys retained). */
export function draftFromView(server: McpServerView): ServerDraft {
  return {
    serverName: server.serverName ?? '',
    transport: server.transport ?? 'stdio',
    command: server.command ?? '',
    args: server.args?.join(', ') ?? '',
    url: server.url ?? '',
    cwd: server.cwd ?? '',
    envRows: (server.envKeys ?? []).map(key => ({ key, value: '', configured: true })),
    headerRows: (server.headerKeys ?? []).map(key => ({ key, value: '', configured: true })),
    toolCallTimeoutMs: server.toolCallTimeoutMs === undefined ? '' : String(server.toolCallTimeoutMs),
    failOnStartupError: server.failOnStartupError ?? false,
    reconnectEnabled: server.reconnect?.enabled ?? false,
    initialDelayMs: server.reconnect?.initialDelayMs === undefined ? '' : String(server.reconnect.initialDelayMs),
    maxDelayMs: server.reconnect?.maxDelayMs === undefined ? '' : String(server.reconnect.maxDelayMs),
    maxAttempts: server.reconnect?.maxAttempts === undefined ? '' : String(server.reconnect.maxAttempts),
  }
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

/** The env/header secret map editor: key + value rows over stored keys. */
function SecretRows(props: {
  rows: SecretRow[]
  onRows: (rows: SecretRow[]) => void
  addLabel: string
  removeLabel: string
  secretPlaceholder: string
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
            placeholder={row.configured ? props.secretPlaceholder : ''}
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
        onClick={() => { props.onRows([...props.rows, { key: '', value: '', configured: false }]) }}
      >
        {props.addLabel}
      </button>
    </div>
  )
}

/** One always-open server form; `server` undefined renders the new-server form. */
function ServerCard(props: {
  server: McpServerView | undefined
  detailId: string
  saving: boolean
  t: McpConfigTabProps['t']
  onSave: (draft: ServerDraft) => void
  onDelete: () => void
}) {
  const { server, t } = props
  const [draft, setDraft] = useState<ServerDraft>(server === undefined ? emptyDraft() : draftFromView(server))
  const [invalid, setInvalid] = useState(false)
  const title = server?.serverName ?? t('newServer')

  const patch = (partial: Partial<ServerDraft>): void => {
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
    <li className={css.card} data-mcp-server={server?.entryId ?? 'new'} data-open="true">
      <header className={css.cardHeader}>
        <strong className={css.cardTitle}>{title}</strong>
        {server?.transport !== undefined
          ? <span className={css.transportTag}>{transportLabel(server.transport, t)}</span>
          : null}
        {server !== undefined ? <code className={css.entryValue}>{server.entryId}</code> : null}
      </header>
      <form className={css.form} onSubmit={(event) => { event.preventDefault(); submit() }}>
        <Field
          id={`${props.detailId}-name`}
          label={t('serverName')}
          value={draft.serverName}
          onChange={(value) => { patch({ serverName: value }) }}
        />
        <div className={css.transportRow}>
          {(['stdio', 'streamable-http'] as const).map(transport => (
            <label key={transport} className={css.transportOption}>
              <input
                type="radio"
                name={`${props.detailId}-transport`}
                checked={draft.transport === transport}
                onChange={() => { patch({ transport }) }}
              />
              {transport === 'stdio' ? t('transportStdio') : t('transportHttp')}
            </label>
          ))}
        </div>
        {draft.transport === 'stdio' ? (
          <>
            <Field id={`${props.detailId}-command`} label={t('command')} value={draft.command} onChange={(value) => { patch({ command: value }) }} />
            <Field id={`${props.detailId}-args`} label={t('args')} value={draft.args} onChange={(value) => { patch({ args: value }) }} />
            <Field id={`${props.detailId}-cwd`} label={t('cwd')} value={draft.cwd} onChange={(value) => { patch({ cwd: value }) }} />
            <div className={css.field}>
              <span className={css.fieldLabel}>{t('envKeys')}</span>
              <SecretRows
                rows={draft.envRows}
                onRows={(envRows) => { patch({ envRows }) }}
                addLabel={t('addRow')}
                removeLabel={t('removeRow')}
                secretPlaceholder={t('secretPlaceholder')}
              />
            </div>
          </>
        ) : (
          <>
            <Field id={`${props.detailId}-url`} label={t('url')} value={draft.url} onChange={(value) => { patch({ url: value }) }} />
            <div className={css.field}>
              <span className={css.fieldLabel}>{t('headerKeys')}</span>
              <SecretRows
                rows={draft.headerRows}
                onRows={(headerRows) => { patch({ headerRows }) }}
                addLabel={t('addRow')}
                removeLabel={t('removeRow')}
                secretPlaceholder={t('secretPlaceholder')}
              />
            </div>
          </>
        )}
        <Field
          id={`${props.detailId}-timeout`}
          label={t('toolCallTimeoutMs')}
          value={draft.toolCallTimeoutMs}
          numeric
          onChange={(value) => { patch({ toolCallTimeoutMs: value }) }}
        />
        <Checkbox
          id={`${props.detailId}-fail`}
          label={t('failOnStartupError')}
          checked={draft.failOnStartupError}
          onChange={(failOnStartupError) => { patch({ failOnStartupError }) }}
        />
        <Checkbox
          id={`${props.detailId}-reconnect`}
          label={t('reconnect')}
          checked={draft.reconnectEnabled}
          onChange={(reconnectEnabled) => { patch({ reconnectEnabled }) }}
        />
        {draft.reconnectEnabled ? (
          <div className={css.reconnectDelays}>
            <span className={css.fieldLabel}>{t('reconnectDelays')}</span>
            <Field id={`${props.detailId}-initial`} label={t('initialDelayMs')} value={draft.initialDelayMs} numeric onChange={(value) => { patch({ initialDelayMs: value }) }} />
            <Field id={`${props.detailId}-max`} label={t('maxDelayMs')} value={draft.maxDelayMs} numeric onChange={(value) => { patch({ maxDelayMs: value }) }} />
            <Field id={`${props.detailId}-attempts`} label={t('maxAttempts')} value={draft.maxAttempts} numeric onChange={(value) => { patch({ maxAttempts: value }) }} />
          </div>
        ) : null}
        {invalid ? <p className={css.invalid} role="alert">{t('invalidServer')}</p> : null}
        <div className={css.actions}>
          <button type="submit" className={css.primaryButton} disabled={props.saving}>
            {props.saving ? t('saving') : t('save')}
          </button>
          {server !== undefined ? (
            <button type="button" className={css.dangerButton} disabled={props.saving} onClick={props.onDelete}>
              {t('deleteServer')}
            </button>
          ) : null}
        </div>
        {server !== undefined ? <p className={css.deleteHint}>{t('deleteHint')}</p> : null}
      </form>
    </li>
  )
}

/** Render the editable MCP server configuration from the user patch layer. */
export function McpConfigTab({ listConfig, upsert, removeServer, t }: McpConfigTabProps): ReactNode {
  const catalogId = useId()
  const [request, setRequest] = useState(0)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [state, setState] = useState<ViewState>({ status: 'loading' })

  useEffect(() => {
    let current = true
    void Promise.resolve().then(() => listConfig()).then(
      (snapshot) => { if (current) setState({ status: 'ready', snapshot }) },
      () => { if (current) setState({ status: 'error' }) },
    )
    return () => { current = false }
  }, [listConfig, request])

  const refresh = (): void => {
    setState({ status: 'loading' })
    setRequest(value => value + 1)
  }

  const retry = (): void => {
    setNotice(null)
    refresh()
  }

  const saveDraft = async (draft: ServerDraft): Promise<void> => {
    setSaving(true)
    setNotice(null)
    try {
      /* v8 ignore next -- the config form only renders in the ready state */
      if (state.status !== 'ready') return
      const view = await upsert(draftToConfig(draft))
      setState({
        status: 'ready',
        snapshot: {
          entries: [
            ...state.snapshot.entries.filter(entry => entry.entryId !== view.entryId),
            view,
          ],
        },
      })
      setNotice(t('saved'))
    } finally {
      setSaving(false)
    }
  }

  const deleteServer = async (serverName: string): Promise<void> => {
    setSaving(true)
    setNotice(null)
    try {
      /* v8 ignore next -- the delete button only renders in the ready state */
      if (state.status !== 'ready') return
      await removeServer(serverName)
      setState({
        status: 'ready',
        snapshot: { entries: state.snapshot.entries.filter(entry => entry.serverName !== serverName) },
      })
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
        <div className={css.catalog}>
          {notice !== null ? <p className={css.notice} role="status">{notice}</p> : null}
          <ul className={css.cards}>
            {state.snapshot.entries.map((server, index) => (
              <ServerCard
                key={server.entryId}
                server={server}
                detailId={`${catalogId}-details-${index}`}
                saving={saving}
                t={t}
                onSave={(draft) => { void saveDraft(draft) }}
                onDelete={() => { void deleteServer(server.serverName ?? '') }}
              />
            ))}
            <ServerCard
              server={undefined}
              detailId={`${catalogId}-new`}
              saving={saving}
              t={t}
              onSave={(draft) => { void saveDraft(draft) }}
              /* v8 ignore next -- the new-server form renders no delete button */
              onDelete={() => {}}
            />
          </ul>
        </div>
      ) : null}
    </div>
  )
}
