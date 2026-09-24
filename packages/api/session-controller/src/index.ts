/** Session Remote owner: cold reads, explicit Agent commands, and live control state. */

import { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { errorChain } from '@deepseek-ai/dsh-llm'
import type {} from '@deepseek-ai/dsh-client-file-upload'
import { canOpenNativePath, openNativePath } from '@deepseek-ai/dsh-native-command'
import type { SessionId } from '@deepseek-ai/dsh-session'
import { SessionAlreadyOwnedError, type SessionInspection } from '@deepseek-ai/dsh-session-persistence'
import type { SessionObservation } from '@deepseek-ai/dsh-session-query'
import { foldSessionTitle } from '@deepseek-ai/dsh-session-title'
import { Remote, RemoteError, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import {
  ApiSessionAgentController,
  ApiSessionNotFound,
  inspectApiSession,
  type ApiSessionAgentResult,
} from './agent.ts'
import { SessionCommandController } from './commands.ts'
import { SessionControlController } from './control.ts'
import { SessionHistoryController } from './history.ts'
import { SessionFileReferences } from './file-references.ts'
import { ApiSessionList } from './list.ts'
import { buildModelCatalog } from './catalog.ts'
import { installModelSelectionProjection } from './model-selection-projection.ts'
import { SessionSkillCatalog } from './skill-catalog.ts'
import { SessionMediaReferences } from './media-references.ts'
import {
  SESSION_TRASH_RETENTION_MS,
  SessionTrash,
  type SessionTrashEntry,
} from './session-trash.ts'
import type {
  ModelCatalog,
  SessionAttachmentRequest,
  SessionAttachmentValue,
  SessionCancelRequest,
  SessionCancelValue,
  SessionControlFrame,
  SessionCreateRequest,
  SessionCreateValue,
  SessionFollowFrame,
  SessionFollowRequest,
  SessionForkRequest,
  SessionForkValue,
  SessionListRequest,
  SessionListTrashedRequest,
  SessionListTrashedValue,
  SessionListValue,
  SessionOpenWorkspacePathRequest,
  SessionOpenWorkspacePathValue,
  SessionPage,
  SessionPageRequest,
  SessionPurgeValue,
  SessionPromptRequest,
  SessionPromptValue,
  SessionRenameRequest,
  SessionRenameValue,
  SessionSearchRequest,
  SessionSearchValue,
  SessionSelectModelRequest,
  SessionRestoreValue,
  SessionTrashHistoryRequest,
  SessionTrashRequest,
  SessionTrashValue,
  SessionSelectModelValue,
  SessionUpdateQueueRequest,
  SessionUpdateQueueValue,
} from './types.ts'

export type * from './types.ts'
export { ApiSessionNotFound } from './agent.ts'
export { SessionFileReferences } from './file-references.ts'
export { SessionSkillCatalog } from './skill-catalog.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** Host Session business API and Remote namespace owner. */
    sessionController: SessionController
  }
}

/** Session Controller deployment policy. */
export interface Config {
  /** Override platform desktop-opener detection. */
  readonly nativeOpen?: boolean
  /** Durable directory containing recoverable-delete metadata. */
  readonly trashRoot?: string
}

/** Host integrations replaceable by direct unit tests. */
export interface SessionControllerInternals {
  /** Native default-application handoff. */
  readonly openPath?: (path: string, signal: AbortSignal) => Promise<void>
  /** Native handoff availability probe. */
  readonly canOpenPath?: () => boolean
}

/** Host service backing the generated `ctx.remote.session` namespace. */
export class SessionController extends TypertRemoteService {
  static inject = [
    'agentDefaultModel',
    'agents',
    'attachments',
    'fileUploads',
    'llm',
    'sessions',
    'sessionProjections',
    'sessionQuery',
    'typert',
    'workspaceRegistry',
  ]

  static Config: z<Config> = z.object({
    nativeOpen: z.boolean(),
    trashRoot: z.string(),
  })

  private readonly agents: ApiSessionAgentController
  private readonly commands: SessionCommandController
  private readonly controlState: SessionControlController
  private readonly history: SessionHistoryController
  private readonly listState: ApiSessionList
  private readonly openPath: (path: string, signal: AbortSignal) => Promise<void>
  private readonly canOpenPath: () => boolean
  private readonly promotions = new Set<Promise<void>>()
  private readonly sessionTrash: SessionTrash | undefined
  private readonly trashReady: Promise<void>
  private readonly trashedSessionIds = new Set<SessionId>()
  private readonly trashOperations = new Map<SessionId, Promise<void>>()

  /**
   * @param ctx - Host context containing the Session capability assembly.
   * @param config - native-opener deployment policy.
   * @param internals - host integrations replaceable by direct unit tests.
   */
  constructor(ctx: Context, config: Config, internals: SessionControllerInternals = {}) {
    super(ctx, 'sessionController', { namespace: 'session' })
    installModelSelectionProjection(ctx)
    this.agents = new ApiSessionAgentController(ctx)
    this.commands = new SessionCommandController(ctx, this.agents, process.cwd())
    this.sessionTrash = config.trashRoot === undefined ? undefined : new SessionTrash(config.trashRoot)
    this.trashReady = this.loadTrash()
    void this.trashReady.catch((error: unknown) => {
      ctx.logger.error(`session-controller: session trash startup failed: ${errorChain(error)}`)
    })
    ctx.effect(() => ctx.fileUploads.registerAgentResolver(async (sessionId) => {
      const result = await this.resolveAgent(sessionId)
      if ('error' in result) throw result.error
      return result.agent
    }), 'session-controller: file-upload Agent resolver')
    this.controlState = new SessionControlController(ctx)
    // Registered before history so reverse-order teardown closes every
    // follower before waiting for already-admitted promotions.
    ctx.effect(() => async () => {
      await Promise.allSettled([...this.promotions])
    }, 'session-controller.promotions')
    this.history = new SessionHistoryController(ctx, (observation) => { this.promote(observation) })
    this.listState = new ApiSessionList(ctx)
    this.openPath = internals.openPath ?? openNativePath
    this.canOpenPath = internals.canOpenPath
      ?? (() => config.nativeOpen ?? (internals.openPath !== undefined || canOpenNativePath()))
    ctx.plugin(SessionFileReferences)
    ctx.plugin(SessionMediaReferences)
    ctx.plugin(SessionSkillCatalog)

    ctx.on('session/created', (session) => {
      this.publishIfVisible(session.id, () => {
        ctx.emit('api-session/added', this.listState.summaryFor(session))
      })
    })
    ctx.on('session/disposed', (session) => {
      this.publishIfVisible(session.id, () => { ctx.emit('api-session/removed', session.id) })
    })
    ctx.on('agent/status', ({ agent, status }) => {
      this.publishIfVisible(agent.id, () => { ctx.emit('api-session/status', agent.id, status === 'running') })
    })
    ctx.on('agent/error', ({ agent, error }) => {
      this.publishIfVisible(agent.id, () => { ctx.emit('api-session/error', agent.id, errorChain(error)) })
    })
    ctx.on('session/event', (session, event) => {
      if (event.type === 'request/header') {
        const agent = ctx.agents.get(session.id)
        if (agent?.session === session) this.agents.consumeSelection(
          agent,
          event.data.header.config.provider,
          event.data.header.config.model,
          event.data.header.config.reasoningEffort,
        )
      }
      if (event.type !== 'user/message' || event.data.source.kind !== 'user') return
      this.publishIfVisible(session.id, () => { ctx.emit('api-session/activity', session.id, event.time) })
    })
  }

  private async loadTrash(): Promise<void> {
    if (this.sessionTrash === undefined) return
    this.replaceTrashedSessionIds(await this.sessionTrash.list())
  }

  private replaceTrashedSessionIds(entries: readonly SessionTrashEntry[]): void {
    this.trashedSessionIds.clear()
    for (const entry of entries) this.trashedSessionIds.add(entry.sessionId)
  }

  private publishIfVisible(sessionId: SessionId, publish: () => void): void {
    if (this.sessionTrash === undefined) {
      publish()
      return
    }
    void this.trashReady.then(() => {
      if (!this.trashedSessionIds.has(sessionId)) publish()
    }).catch((error: unknown) => {
      this.ctx.logger.error(
        `session-controller: skipping Session "${sessionId}" lifecycle publication because trash startup failed: ${errorChain(error)}`,
      )
    })
  }

  private async requireVisibleSession(sessionId: SessionId): Promise<void> {
    await this.trashReady
    if (!this.trashedSessionIds.has(sessionId)) return
    throw new RemoteError(
      'session/trashed',
      `session "${sessionId}" is in the trash; restore it before use`,
      { sessionId },
    )
  }

  private requireTrash(): SessionTrash {
    if (this.sessionTrash !== undefined) return this.sessionTrash
    throw new RemoteError(
      'gateway/internal',
      'session trash is unavailable in this deployment',
      {},
    )
  }

  private missingSession(sessionId: SessionId) {
    return new RemoteError('session/not-found', `session "${sessionId}" not found`, { sessionId })
  }

  private async requireTrashedSession(sessionId: SessionId): Promise<SessionTrashEntry> {
    await this.trashReady
    const entry = await this.requireTrash().get(sessionId)
    if (entry === undefined) throw this.missingSession(sessionId)
    return entry
  }

  private async serialTrash<Value>(
    sessionId: SessionId,
    operation: () => Promise<Value>,
  ): Promise<Value> {
    const previous = this.trashOperations.get(sessionId) ?? Promise.resolve()
    const result = previous.then(operation, operation)
    const next = result.then(() => {}, () => {})
    this.trashOperations.set(sessionId, next)
    try {
      return await result
    } finally {
      if (this.trashOperations.get(sessionId) === next) this.trashOperations.delete(sessionId)
    }
  }

  private async inspectUnchecked(
    sessionId: SessionId,
    signal?: AbortSignal,
  ): Promise<SessionInspection> {
    const attached = this.ctx.sessions.get(sessionId)
    if (attached !== undefined) {
      return {
        meta: attached.header,
        inheritedEventCount: attached.inheritedEventCount,
        events: attached.snapshotEvents(),
      }
    }
    return await inspectApiSession(this.ctx, sessionId, signal)
  }

  private async listTrashEntries(): Promise<readonly SessionTrashEntry[]> {
    await this.trashReady
    const trash = this.requireTrash()
    const entries = await trash.list()
    const now = Date.now()
    if (!entries.some(entry => now - entry.deletedAt >= SESSION_TRASH_RETENTION_MS)) return entries
    const persistence = this.ctx.get('sessionPersistence')
    if (persistence === undefined) return entries
    const result = await trash.sweep(now, async (entry) => {
      if (this.trashOperations.has(entry.sessionId)) {
        throw new Error(`session "${entry.sessionId}" is already changing trash state`)
      }
      await persistence.remove(entry.sessionId)
    })
    for (const failure of result.failures) {
      this.ctx.logger.warn(
        `session-controller: retained expired trashed Session "${failure.entry.sessionId}": ${errorChain(failure.error)}`,
      )
    }
    const current = await trash.list()
    this.replaceTrashedSessionIds(current)
    return current
  }

  private promote(observation: SessionObservation): void {
    const sessionId = observation.header.id
    const task = (async () => {
      using ownedObservation = observation
      const result = await this.agents.resolveObservedAgent(ownedObservation)
      if ('error' in result) {
        this.publishIfVisible(sessionId, () => {
          this.ctx.emit('api-session/error', sessionId, result.error.message)
        })
      }
    })().catch((error: unknown) => {
      this.ctx.logger.error(`session-controller: background activation for "${sessionId}" failed: ${errorChain(error)}`)
    })
    this.promotions.add(task)
    void task.finally(() => { this.promotions.delete(task) })
  }

  /**
   * Resolve or resume one ordinary Session for another Host API domain.
   * @param sessionId - Session identity whose Agent owns the operation.
   * @returns the live Agent or the stable Session-domain failure.
   */
  async resolveAgent(sessionId: SessionId): Promise<ApiSessionAgentResult> {
    await this.requireVisibleSession(sessionId)
    return await this.agents.resolveAgent(sessionId)
  }

  /**
   * Inspect one attached or persisted Session without activating its Agent.
   * @param sessionId - durable Session identity.
   * @param signal - optional caller cancellation for persistence reads.
   * @returns the current attached state or persisted header and event prefix.
   */
  async inspect(
    sessionId: SessionId,
    signal?: AbortSignal,
  ): Promise<SessionInspection> {
    await this.requireVisibleSession(sessionId)
    return await this.inspectUnchecked(sessionId, signal)
  }

  /**
   * Read all visible Session rows without resuming an Agent.
   * @param _request - reserved empty list request.
   * @param signal - cancellation for persistence reads.
   * @returns visible Session summaries ordered by activity.
   */
  @Remote('list')
  async list(_request: SessionListRequest, signal: AbortSignal): Promise<SessionListValue> {
    await this.trashReady
    const items = await this.listState.list(signal)
    return { items: items.filter(item => !this.trashedSessionIds.has(item.sessionId)) }
  }

  /**
   * Search visible Session content without resuming an Agent.
   * @param request - literal message-content query.
   * @param signal - cancellation for list and search reads.
   * @returns authorized bounded Session search results.
   */
  @Remote('search')
  async search(request: SessionSearchRequest, signal: AbortSignal): Promise<SessionSearchValue> {
    await this.trashReady
    const result = await this.listState.search(request.query, signal)
    return {
      ...result,
      items: result.items.filter(item => !this.trashedSessionIds.has(item.sessionId)),
    }
  }

  /**
   * Hide one ordinary Session while retaining its durable log for recovery.
   * @param request - Session identity moved into recoverable-delete state.
   * @returns confirmation after the Session leaves ordinary list and workspace surfaces.
   */
  @Remote('trash')
  async trash(request: SessionTrashRequest): Promise<SessionTrashValue> {
    await this.trashReady
    return await this.serialTrash(request.sessionId, async () => {
      const sessionId = request.sessionId
      const trash = this.requireTrash()
      if (this.trashedSessionIds.has(sessionId)) {
        throw new RemoteError(
          'session/trashed',
          `session "${sessionId}" is already in the trash`,
          { sessionId },
        )
      }
      const initial = await this.inspectUnchecked(sessionId)
      if (initial.meta.origin === 'subagent') {
        throw new RemoteError(
          'session/agent-busy',
          `session "${sessionId}" is owned by subagent routing`,
          { reason: 'subagent Sessions cannot enter the ordinary session trash' },
        )
      }
      this.trashedSessionIds.add(sessionId)
      const workspaces = this.ctx.workspaceRegistry.list()
        .filter(workspace => workspace.sessionIds.includes(sessionId))
      const wasArchived = this.ctx.workspaceRegistry.archivedSessionIds.includes(sessionId)
      const detached: Array<(typeof workspaces)[number]> = []
      let unarchived = false
      let indexed = false
      try {
        const agent = this.ctx.agents.get(sessionId)
        if (agent !== undefined) {
          agent.cancel({ kind: 'user' })
          await agent.whenIdle()
        }
        const attached = this.ctx.sessions.get(sessionId)
        if (attached !== undefined) await this.ctx.sessions.flush(attached)
        const inspection = await this.inspectUnchecked(sessionId)
        if (inspection.meta.origin === 'subagent') {
          throw new RemoteError(
            'session/agent-busy',
            `session "${sessionId}" is owned by subagent routing`,
            { reason: 'subagent Sessions cannot enter the ordinary session trash' },
          )
        }
        const title = foldSessionTitle(inspection.events)?.title
        const entry: SessionTrashEntry = {
          sessionId,
          deletedAt: Date.now(),
          blank: inspection.events.every(event => event.type !== 'turn/start'),
          workspaceIds: workspaces.map(workspace => workspace.id),
          ...(title === undefined ? {} : { title }),
          ...(inspection.meta.cwd === undefined ? {} : { cwd: inspection.meta.cwd }),
          ...(inspection.meta.parentSession === undefined
            ? {}
            : { parentSessionId: inspection.meta.parentSession }),
          ...(inspection.meta.origin === undefined ? {} : { origin: inspection.meta.origin }),
          ...(inspection.meta.agentPreset === undefined ? {} : { agentPreset: inspection.meta.agentPreset }),
        }
        if (wasArchived) {
          await this.ctx.workspaceRegistry.unarchiveSession(sessionId)
          unarchived = true
        }
        for (const workspace of workspaces) {
          await workspace.detachSession(sessionId)
          detached.push(workspace)
        }
        await trash.add(entry)
        indexed = true
        this.ctx.emit('api-session/removed', sessionId)
        return { trashed: true }
      } catch (error: unknown) {
        if (indexed) throw error
        const rollbackFailures: unknown[] = []
        for (const workspace of detached.reverse()) {
          try {
            await workspace.attachSession(sessionId)
          } catch (rollbackError: unknown) {
            rollbackFailures.push(rollbackError)
          }
        }
        if (unarchived) {
          try {
            await this.ctx.workspaceRegistry.archiveSession(sessionId)
          } catch (rollbackError: unknown) {
            rollbackFailures.push(rollbackError)
          }
        }
        this.trashedSessionIds.delete(sessionId)
        if (rollbackFailures.length > 0) {
          throw new AggregateError(
            [error, ...rollbackFailures],
            `session "${sessionId}" trash failed and workspace rollback was incomplete`,
          )
        }
        throw error
      }
    })
  }

  /**
   * Restore one recoverable Session and reattach every surviving former workspace.
   * @param request - Session identity leaving recoverable-delete state.
   * @returns confirmation after the Session is visible to ordinary clients again.
   */
  @Remote('restore')
  async restore(request: SessionTrashRequest): Promise<SessionRestoreValue> {
    return await this.serialTrash(request.sessionId, async () => {
      const sessionId = request.sessionId
      const entry = await this.requireTrashedSession(sessionId)
      try {
        await this.inspectUnchecked(sessionId)
      } catch (error: unknown) {
        if (error instanceof ApiSessionNotFound) throw this.missingSession(sessionId)
        throw error
      }
      const attachedWorkspaceIds: Array<(typeof entry.workspaceIds)[number]> = []
      let indexRemoved = false
      try {
        for (const workspaceId of entry.workspaceIds) {
          const workspace = this.ctx.workspaceRegistry.get(workspaceId)
          if (workspace === undefined || workspace.sessionIds.includes(sessionId)) continue
          await workspace.attachSession(sessionId)
          attachedWorkspaceIds.push(workspaceId)
        }
        const summary = (await this.listState.list(new AbortController().signal))
          .find(item => item.sessionId === sessionId)
        if (summary === undefined) {
          throw new Error(`session "${sessionId}" is durable but has no ordinary list summary`)
        }
        await this.requireTrash().remove(sessionId)
        indexRemoved = true
        this.trashedSessionIds.delete(sessionId)
        this.ctx.emit('api-session/added', summary)
        return { restored: true }
      } catch (error: unknown) {
        if (indexRemoved) throw error
        const rollbackFailures: unknown[] = []
        for (const workspaceId of attachedWorkspaceIds.reverse()) {
          const workspace = this.ctx.workspaceRegistry.get(workspaceId)
          if (workspace === undefined) continue
          try {
            await workspace.detachSession(sessionId)
          } catch (rollbackError: unknown) {
            rollbackFailures.push(rollbackError)
          }
        }
        if (rollbackFailures.length > 0) {
          throw new AggregateError(
            [error, ...rollbackFailures],
            `session "${sessionId}" restore failed and workspace rollback was incomplete`,
          )
        }
        throw error
      }
    })
  }

  /**
   * Permanently remove one recoverable Session after its writer has released it.
   * @param request - Session identity whose durable log is destroyed.
   * @returns confirmation after the log and recovery row are absent.
   */
  @Remote('purge')
  async purge(request: SessionTrashRequest): Promise<SessionPurgeValue> {
    return await this.serialTrash(request.sessionId, async () => {
      const sessionId = request.sessionId
      await this.requireTrashedSession(sessionId)
      const persistence = this.ctx.get('sessionPersistence')
      if (persistence === undefined) {
        throw new RemoteError(
          'gateway/internal',
          'session purge is unavailable: this deployment has no session persistence provider',
          {},
        )
      }
      try {
        await persistence.remove(sessionId)
      } catch (error: unknown) {
        if (error instanceof SessionAlreadyOwnedError) {
          throw new RemoteError(
            'session/trash-active',
            `session "${sessionId}" still has an active writer; close it before permanent removal`,
            { sessionId },
          )
        }
        throw error
      }
      await this.requireTrash().remove(sessionId)
      this.trashedSessionIds.delete(sessionId)
      this.ctx.emit('api-session/removed', sessionId)
      return { purged: true }
    })
  }

  /**
   * List every recoverable Session after an opportunistic retention sweep.
   * @param _request - reserved empty list request.
   * @returns recoverable Sessions ordered by newest deletion first.
   */
  @Remote('listTrashed')
  async listTrashed(_request: SessionListTrashedRequest): Promise<SessionListTrashedValue> {
    const entries = await this.listTrashEntries()
    this.replaceTrashedSessionIds(entries)
    return {
      items: [...entries]
        .sort((left, right) => right.deletedAt - left.deletedAt)
        .map(entry => ({
          sessionId: entry.sessionId,
          deletedAt: entry.deletedAt,
          ...(entry.title === undefined ? {} : { title: entry.title }),
          ...(entry.cwd === undefined ? {} : { cwd: entry.cwd }),
          ...(entry.parentSessionId === undefined ? {} : { parentSessionId: entry.parentSessionId }),
          ...(entry.origin === undefined ? {} : { origin: entry.origin }),
          ...(entry.agentPreset === undefined ? {} : { agentPreset: entry.agentPreset }),
        })),
    }
  }

  /**
   * Read one bounded message page without returning a trashed Session to ordinary lists.
   * @param request - recoverable Session identity and optional backwards page cursor.
   * @param signal - cancellation for durable inspection and paging reads.
   * @returns one chronological message-aligned page.
   */
  @Remote('trashHistory')
  async trashHistory(
    request: SessionTrashHistoryRequest,
    signal: AbortSignal,
  ): Promise<SessionPage> {
    await this.requireTrashedSession(request.sessionId)
    let inspection: SessionInspection
    try {
      inspection = await this.inspectUnchecked(request.sessionId, signal)
    } catch (error: unknown) {
      if (error instanceof ApiSessionNotFound) throw this.missingSession(request.sessionId)
      throw error
    }
    return await this.history.page({
      address: { kind: 'session', sessionId: request.sessionId },
      throughSeq: inspection.events.at(-1)?.seq ?? -1,
      ...(request.beforeSeq === undefined ? {} : { beforeSeq: request.beforeSeq }),
      ...(request.maxMessages === undefined ? {} : { maxMessages: request.maxMessages }),
    }, signal)
  }

  /**
   * Create or idempotently adopt one ordinary Session.
   * @param request - requested identity, location, and Agent preset.
   * @returns the Session identity and resolved preset when configured.
   */
  @Remote('create')
  async create(request: SessionCreateRequest): Promise<SessionCreateValue> {
    if (request.sessionId !== undefined) await this.requireVisibleSession(request.sessionId)
    return await this.commands.create(request)
  }

  /**
   * Select one Session-local model after explicitly resuming the Session.
   * @param request - Session identity and requested model selection.
   * @returns the normalized selection installed for the Session.
   */
  @Remote('selectModel')
  async selectModel(request: SessionSelectModelRequest): Promise<SessionSelectModelValue> {
    await this.requireVisibleSession(request.sessionId)
    return await this.commands.selectModel(request)
  }

  /**
   * Describe every currently routable model for Host-generation selectors.
   * @returns provider-grouped models, the deployment default, and isolated provider failures.
   */
  @Remote('modelCatalog')
  modelCatalog(): Promise<ModelCatalog> {
    return buildModelCatalog(this.ctx)
  }

  /**
   * Report whether this deployment can hand a Session workspace path to a native desktop.
   * @returns true when the matching open operation is available.
   */
  @Remote
  canOpenWorkspacePath(): boolean {
    return this.canOpenPath()
  }

  /**
   * Open one path prepared by a Session-aware caller on the Host desktop.
   * @param request - path after best-effort Session workspace resolution.
   * @param signal - caller lifetime; abort terminates the native command.
   * @returns confirmation after the native opener accepts the path.
   * @throws RemoteError when the request is invalid, cancelled, or the opener fails.
   */
  @Remote('openWorkspacePath')
  async openWorkspacePath(
    request: SessionOpenWorkspacePathRequest,
    signal: AbortSignal,
  ): Promise<SessionOpenWorkspacePathValue> {
    if (request.path.length === 0) {
      throw new RemoteError(
        'gateway/bad-request',
        'session.openWorkspacePath requires a non-empty path',
        {},
      )
    }
    signal.throwIfAborted()
    try {
      await this.openPath(request.path, signal)
      return { opened: true }
    } catch (error: unknown) {
      if (signal.aborted) throw new RemoteError('gateway/cancelled', 'path open was aborted', {})
      throw new RemoteError(
        'gateway/internal',
        `path open failed: ${error instanceof Error ? error.message : String(error)}`,
        {},
      )
    }
  }

  /**
   * Rename one Session after explicitly resuming it.
   * @param request - Session identity and proposed title.
   * @returns the accepted title and durable event sequence.
   */
  @Remote('rename')
  async rename(request: SessionRenameRequest): Promise<SessionRenameValue> {
    await this.requireVisibleSession(request.sessionId)
    return await this.commands.rename(request)
  }

  /**
   * Fork one cold-readable completed-turn prefix into a new Session.
   * @param request - source Session and optional event anchor.
   * @returns the new Session identity.
   */
  @Remote('fork')
  async fork(request: SessionForkRequest): Promise<SessionForkValue> {
    await this.requireVisibleSession(request.sessionId)
    return await this.commands.fork(request)
  }

  /**
   * Admit one prompt after explicitly resuming its Session.
   * @param request - Session identity, prompt content, source metadata, and delivery mode.
   * @param signal - caller cancellation before prompt admission begins.
   * @returns acknowledgement that the Agent accepted the prompt.
   */
  @Remote('prompt')
  async prompt(request: SessionPromptRequest, signal: AbortSignal): Promise<SessionPromptValue> {
    signal.throwIfAborted()
    await this.requireVisibleSession(request.sessionId)
    signal.throwIfAborted()
    return await this.commands.prompt(request)
  }

  /**
   * Read one image proven reachable from the addressed Session log.
   * @param request - Session and attachment identities used for authorization.
   * @returns the durable attachment reference and base64-encoded bytes.
   */
  @Remote('attachment')
  async attachment(request: SessionAttachmentRequest): Promise<SessionAttachmentValue> {
    await this.requireVisibleSession(request.sessionId)
    return await this.commands.attachment(request)
  }

  /**
   * Mutate one still-pending queue occurrence on a live Agent.
   * @param request - Session, queue item, and requested mutation.
   * @returns acknowledgement that the queue mutation was applied.
   */
  @Remote('updateQueue')
  async updateQueue(request: SessionUpdateQueueRequest): Promise<SessionUpdateQueueValue> {
    await this.requireVisibleSession(request.sessionId)
    return this.commands.updateQueue(request)
  }

  /**
   * Cancel one active Agent turn without dropping its pending inbox.
   * @param request - Session whose active Agent turn is cancelled.
   * @returns acknowledgement that cancellation was requested.
   */
  @Remote('cancel')
  async cancel(request: SessionCancelRequest): Promise<SessionCancelValue> {
    await this.requireVisibleSession(request.sessionId)
    return this.commands.cancel(request)
  }

  /**
   * Read one cold-safe, message-aligned Session history page.
   * @param request - durable address, backward cursor, and page budget.
   * @param signal - cancellation for persistence reads.
   * @returns one chronological page.
   */
  @Remote('page')
  async page(request: SessionPageRequest, signal: AbortSignal): Promise<SessionPage> {
    const sessionId = request.address.kind === 'session'
      ? request.address.sessionId
      : request.address.childSessionId
    await this.requireVisibleSession(sessionId)
    return await this.history.page(request, signal)
  }

  /**
   * Follow one Session log from its opening or resume cursor.
   * @param request - durable address and last committed sequence already held by the caller.
   * @param signal - cancellation owned by the Remote stream carrier.
   * @returns a complete opening snapshot followed by gap-free durable event
   *   frames and optional cursorless assistant-stream frames.
   */
  @Remote({ mode: 'stream' })
  async *follow(request: SessionFollowRequest, signal: AbortSignal): AsyncIterable<SessionFollowFrame> {
    const sessionId = request.address.kind === 'session'
      ? request.address.sessionId
      : request.address.childSessionId
    await this.requireVisibleSession(sessionId)
    yield* this.history.follow(request, signal)
  }

  /**
   * Stream a complete live-control baseline followed by replacement frames.
   * @param signal - cancellation owned by the Remote stream carrier.
   * @returns one complete baseline followed by live replacement frames.
   */
  @Remote({ mode: 'stream' })
  control(signal: AbortSignal): AsyncIterable<SessionControlFrame> {
    return this.controlState.control(signal)
  }

}

export { buildModelCatalog }
export default SessionController
