/**
 * The outward sessions-service face — what `ctx.sessions` exposes to feature
 * packages. Transport entry points and implementation internals stay on
 * the concrete class. Widening this interface is the
 * explicit act of widening what features may do to the sessions domain.
 */
import type { Context } from '@deepseek-ai/cordis'
import type { SessionPage, SessionTrashItem } from '../../types.ts'
import type { SubagentAddress } from '@deepseek-ai/dsh-subagent/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { WorkspaceId } from '@deepseek-ai/dsh-workspace/types'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import type { AgentContext } from '../scope.ts'
import type { SessionSearchResultItem } from '../sessions/manager.ts'
import type { SessionBinding, SessionListState } from '../sessions/service.ts'
import type { SessionFace } from './session.ts'
import type { ObservableSnapshot } from '@deepseek-ai/dsh-client-store'

export type { AgentContext } from '../scope.ts'

/** The sessions-service face injected as `ctx.sessions`. */
export interface ISessions {
  /** The useSessions standard feed (list rows + current selection; read face — writes stay inside the domain). */
  readonly list: ObservableSnapshot<SessionListState>
  /**
   * The `session.search` result bound the wire schema fixes, exposed to
   * presentation as injected data. Not per-connection state: every transport
   * (fixture included) reports the same number.
   */
  readonly searchResultLimit: number
  /**
   * Create or adopt a Session on the Host.
   * @param opts - target workspace, directory, and optional preallocated identity.
   * @returns the Session identity after its local binding is addressable.
   */
  create(opts?: {
    workspaceId?: WorkspaceId
    cwd?: string
    sessionId?: SessionId
  }): Promise<SessionId>
  /**
   * Select a session as current.
   * @param id - session id (must exist in the list; unknown ids fail loud).
   */
  open(id: SessionId): void
  /**
   * Open a healthy catalog child through its exact direct-parent address.
   * @param address - catalog-derived parent and child ids.
   */
  openSubagent(address: SubagentAddress): void
  /**
   * Resolve an already discovered direct-parent address without opening it.
   * @param id - possible addressed child id.
   * @returns the retained address, when present.
   */
  subagentAddress(id: SessionId): SubagentAddress | undefined
  /**
   * Mark whether a catalog menu is consuming live membership updates.
   * @param parentSessionId - catalog owner.
   * @param open - current menu state.
   */
  setSubagentCatalogOpen(parentSessionId: SessionId, open: boolean): void
  /**
   * Refresh one direct-child catalog.
   * @param parentSessionId - catalog owner.
   * @returns completion of the current or newly started refresh.
   */
  refreshSubagents(parentSessionId: SessionId): Promise<void>

  /** Clear the current selection into the no-session view state. */
  clear(): void
  /**
   * Refresh the Host-authoritative Session list.
   * @returns completion of the current or newly started Session-list refresh.
   */
  refresh(): Promise<void>
  /**
   * Search the Host's visible message-content index. Results stay
   * request-local; the list snapshot remains the metadata authority.
   * @param query - non-blank literal phrase.
   * @param signal - cancellation for a superseded search.
   * @returns bounded results, or a business/transport error.
   */
  search(
    query: string,
    signal: AbortSignal,
  ): Promise<RemoteResult<{ items: SessionSearchResultItem[]; hasMore: boolean }>>
  /**
   * Fork a session from a completed-turn prefix of the source; on resolution
   * the child is in the list store and `open()` can target it.
   * @param opts - source session id, the optional event seq anchoring the
   *   cut (the boundary is the first turn/end at or after it; an in-log
   *   anchor in an open turn is unavailable rather than clipped backward),
   *   and whether to increment an inherited durable title before resolving.
   * @returns the child session id.
   * @throws when the fork fails, or when a requested child-title rename fails after creation.
   */
  fork(opts: { sessionId: SessionId; atSeq?: number; increaseTitle?: boolean }): Promise<SessionId>
  /**
   * Hide one ordinary Session while retaining its durable log for recovery.
   * File changes remain exactly as they were when the Session was hidden.
   * @param sessionId - ordinary Session identity moved into the trash.
   * @returns resolution after ordinary Session lists receive the removal event.
   */
  trashSession(sessionId: SessionId): Promise<void>
  /**
   * Restore one recoverable Session to its surviving former workspaces.
   * @param sessionId - Session identity leaving the trash.
   * @returns resolution after ordinary Session lists receive the restored row.
   */
  restoreSession(sessionId: SessionId): Promise<void>
  /**
   * Permanently remove one trashed Session after its Host writer has released it.
   * @param sessionId - Session identity whose durable log is destroyed.
   * @returns resolution after the durable log and recovery metadata are removed.
   */
  purgeSession(sessionId: SessionId): Promise<void>
  /**
   * Read recoverable Session rows ordered by newest deletion first.
   * @param signal - optional cancellation for the remote list request.
   * @returns current recoverable-delete metadata.
   */
  listTrashed(signal?: AbortSignal): Promise<readonly SessionTrashItem[]>
  /**
   * Read one message-aligned preview page for a currently trashed Session.
   * @param sessionId - recoverable Session identity.
   * @param beforeSeq - optional backwards cursor.
   * @param maxMessages - optional whole-message page budget.
   * @param signal - optional cancellation for the remote page request.
   * @returns chronological page records for the read-only preview.
   */
  trashHistory(
    sessionId: SessionId,
    beforeSeq?: number,
    maxMessages?: number,
    signal?: AbortSignal,
  ): Promise<SessionPage>
  /**
   * Resolve an Agent-scoped context view (use-and-discard).
   * @param id - session id.
   * @returns scoped ctx, or undefined for a session neither listed nor already scoped.
   */
  scope(id: SessionId): AgentContext | undefined
  /**
   * Read the Agent scope tag off a context (service-method boundary: fetch
   * bundles must reach scope resolution through ctx.sessions).
   * @param ctx - any client context.
   * @returns the session id, or undefined on root contexts.
   */
  scopeOf(ctx: Context): SessionId | undefined
  /**
   * Resolve the session face behind an Agent-scoped context.
   * @param ctx - an Agent-scoped context.
   * @returns the session face, or undefined when the ctx is untagged or its scope was pruned.
   */
  sessionOf(ctx: Context): SessionFace | undefined
  /**
   * Resolve the stable session binding (scope-addressed assembly feed).
   * @param id - session id.
   * @returns binding, or undefined for a session neither listed nor already scoped.
   */
  binding(id: SessionId): SessionBinding | undefined
}
