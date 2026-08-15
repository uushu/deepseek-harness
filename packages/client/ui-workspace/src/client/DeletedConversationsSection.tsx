/**
 * Deleted-conversations settings page: the recoverable-delete surface. Lists
 * trashed sessions (title, deletion moment, remaining retention), opens a
 * read-only transcript preview per conversation, and drives the two terminal
 * actions — restore (conversation comes back; file changes stay reverted)
 * and permanent deletion (red-confirmed, irreversible). The list refetches
 * on mount and after every mutation; there is no live trash feed yet.
 */

import { useCallback, useEffect, useState } from 'react'
import type { HistoryEntry, SessionId, TrashedSession } from '@deepseek-ai/dsh-client-runtime/client'
import { Button, MarkdownText, Modal } from '@deepseek-ai/dsh-client-ui-primitives'
import type { DeletedConversationsSectionProps } from './contract/slots.ts'
import css from './DeletedConversationsSection.module.css'

/** 30 days, mirrored from the Host retention constant (display only). */
const TRASH_RETENTION_MS = 30 * 24 * 60 * 60 * 1000

/** One folded preview row: a message or a tool call between messages. */
interface PreviewRow {
  key: string
  role: 'user' | 'assistant' | 'tool'
  text: string
  toolName?: string
  toolArguments?: string
  toolOutput?: string
}

/** Fold a trashed session's history page into display rows. */
function foldPreview(entries: readonly HistoryEntry[]): PreviewRow[] {
  const resultsByCallId = new Map<string, string>()
  for (const { event } of entries) {
    if (event.type !== 'tool/result') continue
    const data = event.data as { message?: { content?: unknown } } | undefined
    const content = data?.message?.content
    if (Array.isArray(content)) {
      const text = contentText(content)
      if (text !== '') resultsByCallId.set((event.data as { callId?: string }).callId ?? '', text)
    }
  }
  const rows: PreviewRow[] = []
  for (const { event } of entries) {
    if (event.type === 'user/message') {
      const content = (event.data as { content?: unknown }).content
      rows.push({ key: `${event.seq}:user`, role: 'user', text: contentText(content) })
    } else if (event.type === 'assistant/message') {
      const content = (event.data as { message?: { content?: unknown } }).message?.content
      rows.push({ key: `${event.seq}:assistant`, role: 'assistant', text: contentText(content) })
    } else if (event.type === 'tool/call') {
      const data = event.data as { callId?: string; name?: string; arguments?: string }
      const output = resultsByCallId.get(data.callId ?? '')
      rows.push({
        key: `${event.seq}:tool`,
        role: 'tool',
        text: '',
        toolName: data.name ?? '',
        toolArguments: data.arguments ?? '',
        ...(output === undefined ? {} : { toolOutput: output }),
      })
    }
  }
  return rows
}

/** Extract joined text blocks from a message content array (defensive). */
function contentText(content: unknown): string {
  if (!Array.isArray(content)) return ''
  return content
    .filter((block): block is { type: string; text: string } =>
      typeof block === 'object' && block !== null
      && (block as { type?: unknown }).type === 'text'
      && typeof (block as { text?: unknown }).text === 'string')
    .map(block => block.text)
    .join('\n')
}

/** Display title fallback: durable title → cwd basename → session id. */
function displayTitleOf(entry: TrashedSession): string {
  if (entry.title !== undefined && entry.title !== '') return entry.title
  const parts = entry.cwd?.split(/[\\/]/).filter(part => part !== '')
  if (parts !== undefined && parts.length > 0) return parts[parts.length - 1] ?? entry.sessionId
  return entry.sessionId
}

/** Whole days until the retention window closes (floor 0). */
function remainingDays(deletedAt: number, now: number): number {
  return Math.max(0, Math.ceil((deletedAt + TRASH_RETENTION_MS - now) / (24 * 60 * 60 * 1000)))
}

/** Local date-time rendering (the workspace namespace has no clock seat). */
function formatDateTime(time: number): string {
  const date = new Date(time)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/**
 * Render the deleted-conversations settings page.
 * @param props - the settings-shell owner share, injected trash actions, and the locale seat.
 */
export function DeletedConversationsSection({
  t, listTrashed, trashHistory, restore, purge,
}: DeletedConversationsSectionProps) {

  const [entries, setEntries] = useState<readonly TrashedSession[] | null>(null)
  const [listError, setListError] = useState<string | null>(null)
  const [previewId, setPreviewId] = useState<SessionId | null>(null)
  const [previewRows, setPreviewRows] = useState<readonly PreviewRow[] | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<SessionId | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [purgeTarget, setPurgeTarget] = useState<TrashedSession | null>(null)
  const [purging, setPurging] = useState(false)
  const [purgeError, setPurgeError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setListError(null)
    try {
      setEntries(await listTrashed())
    } catch (error: unknown) {
      setListError(error instanceof Error ? error.message : String(error))
      setEntries([])
    }
  }, [listTrashed])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const openPreview = useCallback(async (entry: TrashedSession) => {
    setPreviewId(entry.sessionId)
    setPreviewRows(null)
    setPreviewError(null)
    try {
      const page = await trashHistory(entry.sessionId, undefined, undefined)
      setPreviewRows(foldPreview(page.events))
    } catch (error: unknown) {
      setPreviewError(error instanceof Error ? error.message : String(error))
      setPreviewRows([])
    }
  }, [trashHistory])

  const closePreview = useCallback(() => {
    setPreviewId(null)
    setPreviewRows(null)
    setPreviewError(null)
  }, [])

  const onRestore = useCallback(async (entry: TrashedSession) => {
    if (busyId !== null) return
    setBusyId(entry.sessionId)
    setActionError(null)
    setNotice(null)
    try {
      await restore(entry.sessionId)
      setNotice(t('trash.restored'))
      if (previewId === entry.sessionId) closePreview()
      await refresh()
    } catch (error: unknown) {
      setActionError(error instanceof Error ? error.message : String(error))
    } finally {
      setBusyId(null)
    }
  }, [busyId, previewId, restore, refresh, closePreview, t])

  const confirmPurge = useCallback(async () => {
    if (purging || purgeTarget === null) return
    setPurging(true)
    setPurgeError(null)
    try {
      await purge(purgeTarget.sessionId)
      setPurgeTarget(null)
      if (previewId === purgeTarget.sessionId) closePreview()
      await refresh()
    } catch (error: unknown) {
      setPurgeError(error instanceof Error ? error.message : String(error))
    } finally {
      setPurging(false)
    }
  }, [purging, purgeTarget, previewId, purge, refresh, closePreview])

  const now = Date.now()
  const previewEntry = entries?.find(entry => entry.sessionId === previewId) ?? null
  const expiresLabel = (deletedAt: number): string => {
    const days = remainingDays(deletedAt, now)
    return days > 0 ? t('trash.expiresIn', { n: String(days) }) : t('trash.expiresSoon')
  }
  const restoreLabel = (sessionId: SessionId): string =>
    busyId === sessionId ? t('trash.restore.pending') : t('trash.restore')

  return (
    <div className={css.section}>
      <h2 className={css.heading}>{t('trash.title')}</h2>
      <p className={css.intro}>{t('trash.desc')}</p>

      {previewEntry !== null ? (
        <div className={css.preview}>
          <div className={css.previewHeader}>
            <button type="button" className={css.back} onClick={closePreview}>
              <span className={css.backIcon} aria-hidden="true">←</span>
              {t('trash.preview.back')}
            </button>
            <h3 className={css.previewTitle}>{displayTitleOf(previewEntry)}</h3>
            <div className={css.previewMeta}>
              <span>{t('trash.deletedAt', { time: formatDateTime(previewEntry.deletedAt) })}</span>
              <span className={css.expires}>{expiresLabel(previewEntry.deletedAt)}</span>
            </div>
            <div className={css.previewActions}>
              <Button
                variant="outline"
                disabled={busyId !== null}
                onClick={() => { void onRestore(previewEntry) }}
              >
                {restoreLabel(previewEntry.sessionId)}
              </Button>
              <Button
                variant="outline"
                className={css.dangerAction}
                disabled={busyId !== null || purging}
                onClick={() => { setPurgeTarget(previewEntry); setPurgeError(null) }}
              >
                {t('trash.purge')}
              </Button>
            </div>
            {actionError !== null && <div className={css.error} role="alert">{t('trash.restoreFailed', { error: actionError })}</div>}
          </div>
          {previewError !== null
            ? <div className={css.error} role="alert">{t('trash.preview.failed', { error: previewError })}</div>
            : previewRows === null
              ? <p className={css.previewLoading}>{t('trash.preview.loading')}</p>
              : previewRows.length === 0
                ? <p className={css.empty}>{t('trash.preview.empty')}</p>
                : (
                  <div className={css.transcript}>
                    {previewRows.map((row) => {
                      if (row.role === 'tool') {
                        return (
                          <div key={row.key} className={css.toolRow}>
                            <span className={css.toolName}>{t('trash.toolCall', { name: row.toolName ?? '' })}</span>
                            {row.toolArguments !== '' && (
                              <pre className={css.toolArgs}>{row.toolArguments}</pre>
                            )}
                            {row.toolOutput !== undefined && row.toolOutput !== '' && (
                              <pre className={css.toolOutput}>{row.toolOutput}</pre>
                            )}
                          </div>
                        )
                      }
                      if (row.text === '') return null
                      return (
                        <div key={row.key} className={row.role === 'user' ? css.userRow : css.assistantRow}>
                          <span className={css.rowLabel}>
                            {row.role === 'user' ? t('trash.user') : t('trash.assistant')}
                          </span>
                          <div className={css.rowBody}>
                            <MarkdownText text={row.text} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
        </div>
      ) : (
        <>
          {listError !== null && <div className={css.error} role="alert">{t('trash.loadFailed', { error: listError })}</div>}
          {notice !== null && <div className={css.notice} role="status">{notice}</div>}
          {actionError !== null && <div className={css.error} role="alert">{actionError}</div>}
          {entries === null ? (
            <p className={css.empty}>{t('trash.preview.loading')}</p>
          ) : entries.length === 0 ? (
            <p className={css.empty}>{t('trash.empty')}</p>
          ) : (
            <>
              <p className={css.count}>
                {entries.length === 1
                  ? t('trash.count.one', { n: '1' })
                  : t('trash.count.other', { n: String(entries.length) })}
              </p>
              <ul className={css.list}>
                {entries.map(entry => (
                  <li key={entry.sessionId} className={css.row}>
                    <div className={css.rowMain}>
                      <span className={css.rowTitle}>{displayTitleOf(entry)}</span>
                      <span className={css.rowMeta}>
                        {t('trash.deletedAt', { time: formatDateTime(entry.deletedAt) })}
                        {' · '}
                        {expiresLabel(entry.deletedAt)}
                      </span>
                    </div>
                    <div className={css.rowActions}>
                      <Button variant="outline" size="sm" onClick={() => { void openPreview(entry) }}>
                        {t('trash.preview')}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busyId !== null}
                        onClick={() => { void onRestore(entry) }}
                      >
                        {restoreLabel(entry.sessionId)}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className={css.dangerAction}
                        disabled={busyId !== null || purging}
                        onClick={() => { setPurgeTarget(entry); setPurgeError(null) }}
                      >
                        {t('trash.purge')}
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}

      <Modal
        open={purgeTarget !== null}
        onClose={() => { if (!purging) setPurgeTarget(null) }}
        closeLabel={t('close')}
        title={t('trash.purge.title')}
        titleClassName={css.dangerTitle as string}
        description={t('trash.purge.desc')}
        descriptionClassName={css.dangerDescription as string}
        footer={(
          <>
            <Button variant="outline" disabled={purging} onClick={() => { setPurgeTarget(null) }}>{t('cancel')}</Button>
            <Button
              variant="outline"
              className={css.dangerAction}
              disabled={purging}
              onClick={() => { void confirmPurge() }}
            >
              {purging ? t('trash.purge.pending') : t('trash.purge.confirm')}
            </Button>
          </>
        )}
      >
        {purgeError !== null && <div className={css.error} role="alert">{t('trash.purgeFailed', { error: purgeError })}</div>}
      </Modal>
    </div>
  )
}
