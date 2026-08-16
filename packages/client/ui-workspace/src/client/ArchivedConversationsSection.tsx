/**
 * Archived-conversations settings page: the restore surface for sessions
 * hidden by Archive. The list is the runtime's live archive set projected
 * over session summaries — rows disappear reactively on restore (the archive
 * set shrinks) and on move-to-trash (the session leaves the archive set and
 * the session list). Restore is dialog-free: not destructive, the row simply
 * returns to its workspace group at its original accounting slot. Moving to
 * trash is red-confirmed.
 */

import { useCallback, useMemo, useState } from 'react'
import type { SessionId, SessionSummary } from '@deepseek-ai/dsh-client-runtime/client'
import { Button, IconTrashOutline16, Modal } from '@deepseek-ai/dsh-client-ui-primitives'
import type { ArchivedConversationsSectionProps } from './contract/slots.ts'
import css from './ArchivedConversationsSection.module.css'

/** Local date-time rendering (same shape as the deleted-conversations page). */
function formatDateTime(time: number): string {
  const date = new Date(time)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** Display title fallback: durable title → cwd basename → session id. */
function displayTitleOf(entry: SessionSummary): string {
  if (entry.displayTitle !== '') return entry.displayTitle
  const parts = entry.cwd?.split(/[\\/]/).filter(part => part !== '')
  if (parts !== undefined && parts.length > 0) return parts[parts.length - 1] ?? entry.id
  return entry.id
}

/**
 * Render the archived-conversations settings page.
 * @param props - the settings-shell owner share, the runtime list hooks, the injected actions, and the locale seat.
 */
export function ArchivedConversationsSection({
  t, useSessions, useWorkspaces, unarchive, trashSession,
}: ArchivedConversationsSectionProps) {

  const archivedSessionIds = useWorkspaces(state => state.archivedSessionIds)
  const workspaces = useWorkspaces(state => state.items)
  const sessions = useSessions(state => state)
  const [busyId, setBusyId] = useState<SessionId | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [trashTarget, setTrashTarget] = useState<SessionId | null>(null)
  const [trashing, setTrashing] = useState(false)
  const [trashError, setTrashError] = useState<string | null>(null)

  // Archive order is durable but recency is what a restore hunt needs: rows
  // sort by last activity, newest first. Summaries that have not landed yet
  // (list pull leading the workspace baseline) appear when they do.
  const rows = useMemo(() => {
    const workspaceBySession = new Map<SessionId, string>()
    for (const workspace of workspaces) {
      for (const sessionId of workspace.sessionIds) {
        if (!workspaceBySession.has(sessionId)) workspaceBySession.set(sessionId, workspace.title)
      }
    }
    const items: Array<{ session: SessionSummary; workspaceLabel: string }> = []
    for (const id of archivedSessionIds) {
      const session = sessions.byId[id]
      if (session === undefined) continue
      items.push({ session, workspaceLabel: workspaceBySession.get(id) ?? t('group.ungrouped') })
    }
    items.sort((a, b) => b.session.updatedAt - a.session.updatedAt)
    return items
  }, [archivedSessionIds, workspaces, sessions.byId, t])

  const onRestore = useCallback(async (sessionId: SessionId) => {
    if (busyId !== null) return
    setBusyId(sessionId)
    setActionError(null)
    setNotice(null)
    try {
      await unarchive(sessionId)
      setNotice(t('archived.restored'))
    } catch (error: unknown) {
      setActionError(t('archived.restoreFailed', {
        error: error instanceof Error ? error.message : String(error),
      }))
    } finally {
      setBusyId(null)
    }
  }, [busyId, unarchive, t])

  const confirmTrash = useCallback(async () => {
    if (trashing || trashTarget === null) return
    setTrashing(true)
    setTrashError(null)
    try {
      await trashSession(trashTarget)
      setTrashTarget(null)
    } catch (error: unknown) {
      setTrashError(t('archived.trashFailed', {
        error: error instanceof Error ? error.message : String(error),
      }))
    } finally {
      setTrashing(false)
    }
  }, [trashing, trashTarget, trashSession, t])

  return (
    <div className={css.section}>
      <h2 className={css.heading}>{t('archived.title')}</h2>
      <p className={css.intro}>{t('archived.desc')}</p>

      {notice !== null && <div className={css.notice} role="status">{notice}</div>}
      {actionError !== null && <div className={css.error} role="alert">{actionError}</div>}

      {rows.length === 0 ? (
        <p className={css.empty}>{t('archived.empty')}</p>
      ) : (
        <>
          <p className={css.count}>
            {rows.length === 1
              ? t('archived.count.one', { n: '1' })
              : t('archived.count.other', { n: String(rows.length) })}
          </p>
          <ul className={css.list}>
            {rows.map(({ session, workspaceLabel }) => (
              <li key={session.id} className={css.row}>
                <div className={css.rowMain}>
                  <span className={css.rowTitle}>{displayTitleOf(session)}</span>
                  <span className={css.rowMeta}>
                    {workspaceLabel}
                    {' · '}
                    {t('archived.updatedAt', { time: formatDateTime(session.updatedAt) })}
                  </span>
                </div>
                <div className={css.rowActions}>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busyId !== null}
                    onClick={() => { void onRestore(session.id) }}
                  >
                    {busyId === session.id ? t('archived.restore.pending') : t('archived.restore')}
                  </Button>
                  <button
                    type="button"
                    className={css.trashButton}
                    aria-label={t('archived.trash')}
                    title={t('archived.trash')}
                    disabled={busyId !== null || trashing}
                    onClick={() => { setTrashTarget(session.id); setTrashError(null) }}
                  >
                    <IconTrashOutline16 size={16} className={css.trashIcon} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      <Modal
        open={trashTarget !== null}
        onClose={() => { if (!trashing) setTrashTarget(null) }}
        closeLabel={t('close')}
        title={t('archived.trash.title')}
        titleClassName={css.dangerTitle as string}
        description={t('archived.trash.desc')}
        descriptionClassName={css.dangerDescription as string}
        footer={(
          <>
            <Button variant="outline" disabled={trashing} onClick={() => { setTrashTarget(null) }}>{t('cancel')}</Button>
            <Button
              variant="outline"
              className={css.dangerAction}
              disabled={trashing}
              onClick={() => { void confirmTrash() }}
            >
              {trashing ? t('archived.trash.pending') : t('archived.trash.confirm')}
            </Button>
          </>
        )}
      >
        {trashError !== null && <div className={css.error} role="alert">{trashError}</div>}
      </Modal>
    </div>
  )
}
