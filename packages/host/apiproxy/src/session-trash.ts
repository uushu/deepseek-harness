/**
 * Session trash: the recoverable-delete index behind `session.trash` /
 * `session.restore` / `session.purge` / `session.listTrashed`. Deleting a
 * session moves it into the trash instead of destroying it: the durable log
 * stays in persistence (so the deleted conversation can be previewed and
 * restored), and this index records the deletion moment plus the metadata
 * restore needs.
 *
 * The index lives OUTSIDE the session log (a JSON file under the harness
 * home) so trash/restore never touches the log artifact; only purge removes
 * it. Storage mechanics live in the shared {@link TrashIndex}; this class
 * adds the session-shaped entry and its retention window.
 * @module @deepseek-ai/dsh-host-apiproxy/session-trash
 */

import type { SessionId } from '@deepseek-ai/dsh-session'
import type { WorkspaceId } from './api/index.ts'
import { TrashIndex } from './trash-index.ts'

/** How long a trashed session stays recoverable before the sweep purges it. */
export const SESSION_TRASH_RETENTION_MS = 30 * 24 * 60 * 60 * 1000

/** One recoverable deletion: the session identity plus restore metadata. */
export interface SessionTrashEntry {
  /** The trashed session's durable identity (restore reuses it). */
  readonly sessionId: SessionId
  /** Unix epoch milliseconds of the trash action (the retention anchor). */
  readonly deletedAt: number
  /** The session's blank bit at trash time (the restore frame carries it). */
  readonly blank: boolean
  /** Workspaces the session was attached to at trash time (restore reattaches survivors). */
  readonly workspaceIds: WorkspaceId[]
  /** Project directory the session was created in, if any. */
  readonly cwd?: string
  /** The session this one was forked from, if any. */
  readonly parentSessionId?: SessionId
  /** Coarse product classification (subagent sessions refuse trash, so this is informational). */
  readonly origin?: 'subagent'
  /** The composition the session's agent was built from. */
  readonly agentPreset?: string
}

/** The session trash index (one JSON file per root). */
export class SessionTrash extends TrashIndex<SessionTrashEntry> {
  /**
   * @param root - directory that will hold `index.json` (created on demand).
   */
  constructor(root: string) {
    super(root, SESSION_TRASH_RETENTION_MS)
  }

  /**
   * Look up one trashed session.
   * @param sessionId - the trashed session to find.
   * @returns the trash row, or undefined when the session is not in the trash.
   */
  async get(sessionId: SessionId): Promise<SessionTrashEntry | undefined> {
    return (await this.list()).find(entry => entry.sessionId === sessionId)
  }

  /**
   * Record one trashed session (upsert: a repeated trash replaces the row).
   * @param entry - the deletion record to persist.
   */
  add(entry: SessionTrashEntry): Promise<void> {
    return this.mutate((entries) => {
      const rest = entries.filter(candidate => candidate.sessionId !== entry.sessionId)
      return [...rest, entry]
    })
  }

  /**
   * Remove one trashed session's index row (restore or purge).
   * @param sessionId - the trashed session to drop from the index.
   * @returns a promise resolving once the row is removed.
   */
  remove(sessionId: SessionId): Promise<void> {
    return this.mutate(entries => entries.filter(candidate => candidate.sessionId !== sessionId))
  }
}
