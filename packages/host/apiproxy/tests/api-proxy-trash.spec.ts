/**
 * Recoverable-delete domain (`session.trash`/`restore`/`purge`/`listTrashed`/
 * `trashHistory`): soft delete keeps the durable log, restore brings the row
 * back through a `host/session-restored` frame, purge destroys the log, the
 * retention sweep drops expired entries, and the trash is a hard boundary —
 * trashed sessions disappear from `session.list` and refuse ordinary
 * `history`/`fork`/`create` until restored.
 */

import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import AgentRegistry, { Inbox } from '@deepseek-ai/dsh-agent'
import type { Agent, AgentFactory } from '@deepseek-ai/dsh-agent'
import SessionStore, { SessionId } from '@deepseek-ai/dsh-session'
import type { Session, SessionEvent, SessionHeader } from '@deepseek-ai/dsh-session'
import Storage from '@deepseek-ai/dsh-storage'
import { DomainFacility } from '@deepseek-ai/dsh-storage-domain'
import UserQuestionService from '@deepseek-ai/dsh-user-questions'
import WorkspaceRegistry from '@deepseek-ai/dsh-workspace'
import type { HostFrame } from '@deepseek-ai/dsh-host-apiproxy/api'
import type { RpcRequest, RpcResponse } from '@deepseek-ai/dsh-host-apiproxy/api/rpc'
import { RpcId } from '@deepseek-ai/dsh-host-apiproxy/api/rpc'
import { createApiProxy } from '@deepseek-ai/dsh-host-apiproxy'
import {
  SESSION_TRASH_RETENTION_MS, SessionTrash,
} from '../src/session-trash.ts'
import { MemoryStorageBackend } from '../../../storage/storage-domain/tests/helpers/memory-backend.ts'

let nextRpc = 1

function request<P>(payload: P): RpcRequest<P> {
  return { rpcId: RpcId(`trash-${String(nextRpc++)}`), payload }
}

function expectOk<T>(response: RpcResponse<T>): T {
  expect(response.result.ok).toBe(true)
  if (!response.result.ok) throw new Error('unreachable')
  return response.result.value
}

async function nextHostFrame(
  stream: AsyncIterator<RpcRequest<HostFrame>>,
): Promise<RpcRequest<HostFrame>> {
  const next = await stream.next()
  if (next.done === true) throw new Error('Host stream ended before the expected increment')
  return next.value
}

function stubAgent(session: Session): Agent {
  return {
    id: session.id,
    options: {},
    session,
    inbox: new Inbox(session, { inserted: () => {}, discarded: () => {}, claimed: () => {} }),
    status: 'idle',
    ctx: new Context(),
    send: () => {},
    followup: () => {},
    steer: () => ({ outcome: Promise.resolve({ status: 'rejected' as const }) }),
    inject: () => {},
    cancel() {},
    runMaintenance: job => job(new AbortController().signal),
    whenIdle: () => Promise.resolve(),
  }
}

/** In-memory persistence double covering the trash domain's reads and purges. */
function fakePersistence(root: string) {
  const logs = new Map<SessionId, SessionEvent[]>()
  const headers = new Map<SessionId, SessionHeader>()
  return {
    list: () => Promise.resolve([...headers.values()]),
    locate: (meta: SessionHeader) => ({ kind: 'jsonl', path: join(root, `${meta.id}.jsonl`) }),
    readFrom: (id: SessionId) => {
      const header = headers.get(id)
      if (header === undefined) return Promise.reject(new Error(`no log for ${id}`))
      return Promise.resolve({ meta: header, events: logs.get(id) ?? [] })
    },
    create: (meta: SessionHeader) => {
      headers.set(meta.id, meta)
      logs.set(meta.id, [])
      return Promise.resolve()
    },
    append: (id: SessionId, events: readonly SessionEvent[]) => {
      logs.set(id, [...(logs.get(id) ?? []), ...events])
      return Promise.resolve()
    },
  }
}

/** Compose the API over real Session, Agent, Storage, Domain, and Workspace services. */
async function harness() {
  const root = realpathSync.native(mkdtempSync(join(tmpdir(), 'dsh-apiproxy-trash-')))
  const ctx = new Context()
  await ctx.plugin(SessionStore)
  await ctx.plugin(AgentRegistry)
  await ctx.plugin(UserQuestionService)
  await ctx.plugin(Storage)
  ctx.storage.backend.register('memory', new MemoryStorageBackend())
  const storageDomain = new DomainFacility(ctx, { backend: 'memory', routes: {} })
  ctx.storage.mount('domain', storageDomain)
  ctx.provide('storageDomain', storageDomain)
  const persistence = fakePersistence(root)
  ctx.provide('sessionPersistence', persistence as never)
  await ctx.plugin(WorkspaceRegistry)

  const factory: AgentFactory = {
    async createAgent(_ownerCtx, options) {
      const session = ctx.sessions.create(
        options.sessionId,
        options.meta === undefined ? {} : { meta: options.meta },
      )
      const agent = stubAgent(session)
      const unregister = ctx.agents.register(agent)
      return {
        agent,
        dispose: () => {
          unregister()
          return Promise.resolve()
        },
      }
    },
    async resume() {
      throw new Error('test harness has no persisted sessions')
    },
  }
  ctx.agents.setFactory(factory)
  ctx.provide('directoryPicker', { capability: () => ({ kind: 'native', pick: async () => null }) } as never)

  const trash = new SessionTrash(join(root, 'trash'))
  const api = createApiProxy(ctx, {
    defaultModelSelection: () => ({ provider: 'deepseek', model: 'deepseek-v4-flash' }),
    saveDefaultModelSelection: () => Promise.resolve(),
    cwd: root,
    sessionTrash: trash,
  })
  const host = api.events.host(request({}), new AbortController().signal)[Symbol.asyncIterator]()
  return {
    root,
    api,
    host,
    persistence,
    trash,
    async dispose(): Promise<void> {
      rmSync(root, { recursive: true, force: true })
    },
  }
}

/** Seed a session with a title, a user message, an assistant reply, and one tool call/result. */
function seedConversation(): SessionEvent[] {
  return [
    { type: 'turn/start', seq: 0, time: 1, data: { turn: 0 } } as SessionEvent,
    {
      type: 'user/message', seq: 1, time: 2,
      data: { content: [{ type: 'text', text: '帮我写一个 hello world' }], messageSeqs: [1], source: { kind: 'user' } },
    } as SessionEvent,
    { type: 'step/start', seq: 2, time: 3, data: { turn: 0, step: 0 } } as SessionEvent,
    {
      type: 'assistant/message', seq: 3, time: 4,
      data: {
        turn: 0,
        step: 0,
        message: { content: [{ type: 'text', text: '好的，这是代码：`print("hello")`' }], messageSeqs: [3], source: { kind: 'model' } },
      },
    } as SessionEvent,
    { type: 'step/end', seq: 4, time: 5, data: { turn: 0, step: 0 } } as SessionEvent,
    { type: 'turn/end', seq: 5, time: 6, data: { turn: 0, reason: { kind: 'completed' } } } as SessionEvent,
    { type: 'session/title', seq: 6, time: 7, data: { title: '实验记录', messageSeqs: [], source: { kind: 'user' } } } as SessionEvent,
  ]
}

describe('session.trash', () => {
  it('hides the session from list/history/fork, keeps the log, and emits the removal frame', async () => {
    const h = await harness()
    try {
      const sessionId = SessionId('session-trash-me')
      expectOk(await h.api.sessions.create(request({ sessionId, cwd: h.root })))
      await h.persistence.create({ version: 0, id: sessionId, createdAt: Date.now(), cwd: h.root } as SessionHeader)
      await h.persistence.append(sessionId, seedConversation())
      expectOk(await h.api.sessions.create(request({ sessionId: SessionId('session-other'), cwd: h.root })))
      // Drain the two creation frames before asserting the removal increment.
      expect((await nextHostFrame(h.host)).payload.type).toBe('host/session-added')
      expect((await nextHostFrame(h.host)).payload.type).toBe('host/session-added')

      const removal = nextHostFrame(h.host)
      const trashed = await h.api.sessions.trash(request({ sessionId }))
      expect(trashed.result).toMatchObject({ ok: true, value: { trashed: true } })
      expect((await removal).payload).toMatchObject({ type: 'host/session-removed', sessionId })

      // Gone from the visible list, but the durable log survived.
      const listed = expectOk(await h.api.sessions.list(request({}))).items.map(item => item.sessionId)
      expect(listed).not.toContain(sessionId)
      expect(listed).toContain('session-other')

      // Ordinary reads and forks refuse the trashed identity.
      const history = await h.api.sessions.history(request({ sessionId }))
      expect(history.result).toMatchObject({ ok: false, error: { code: 'session-not-found' } })
      const fork = await h.api.sessions.fork(request({ sessionId }))
      expect(fork.result).toMatchObject({ ok: false, error: { code: 'session-not-found' } })
      const recreate = await h.api.sessions.create(request({ sessionId, cwd: h.root }))
      expect(recreate.result).toMatchObject({ ok: false, error: { code: 'session-trashed' } })

      // The trash page lists it with its durable title.
      const trashList = expectOk(await h.api.sessions.listTrashed(request({}))).items
      expect(trashList).toHaveLength(1)
      expect(trashList[0]).toMatchObject({ sessionId, title: '实验记录', cwd: h.root })
      expect(trashList[0]!.deletedAt).toBeGreaterThan(0)

      // The preview serves the kept log through the trash-only path.
      const preview = expectOk(await h.api.sessions.trashHistory(request({ sessionId })))
      expect(preview.events.map(event => event.event.type)).toContain('user/message')
      expect(preview.events.map(event => event.event.type)).toContain('assistant/message')
      expect(preview.hasMore).toBe(false)
    } finally {
      await h.dispose()
    }
  })

  it('rejects unknown sessions and repeated trashes', async () => {
    const h = await harness()
    try {
      const sessionId = SessionId('session-ghost')
      const missing = await h.api.sessions.trash(request({ sessionId }))
      expect(missing.result).toMatchObject({
        ok: false,
        error: { code: 'session-not-found', details: { sessionId } },
      })

      const live = SessionId('session-twice')
      expectOk(await h.api.sessions.create(request({ sessionId: live, cwd: h.root })))
      expectOk(await h.api.sessions.trash(request({ sessionId: live })))
      const again = await h.api.sessions.trash(request({ sessionId: live }))
      expect(again.result).toMatchObject({ ok: false, error: { code: 'session-trashed' } })
    } finally {
      await h.dispose()
    }
  })

  it('trashes with the default conversation-only scope and clears nothing else', async () => {
    const h = await harness()
    try {
      const sessionId = SessionId('session-files')
      const createdFile = join(h.root, 'created.txt')
      const editedFile = join(h.root, 'edited.txt')
      writeFileSync(editedFile, 'original body')
      writeFileSync(createdFile, 'agent wrote me')

      expectOk(await h.api.sessions.create(request({ sessionId, cwd: h.root })))
      // Deletion is conversation-only: files stay exactly as the session
      // left them.
      expectOk(await h.api.sessions.trash(request({ sessionId })))
      expect(existsSync(createdFile)).toBe(true)
      expect(readFileSync(createdFile, 'utf8')).toBe('agent wrote me')
      expect(existsSync(editedFile)).toBe(true)
    } finally {
      await h.dispose()
    }
  })
})

describe('session.restore', () => {
  it('reattaches the row through a host/session-restored frame and clears the trash', async () => {
    const h = await harness()
    try {
      const sessionId = SessionId('session-restore-me')
      expectOk(await h.api.sessions.create(request({ sessionId, cwd: h.root })))
      await h.persistence.create({ version: 0, id: sessionId, createdAt: Date.now(), cwd: h.root } as SessionHeader)
      await h.persistence.append(sessionId, seedConversation())
      expectOk(await h.api.sessions.trash(request({ sessionId })))
      expect(expectOk(await h.api.sessions.listTrashed(request({}))).items).toHaveLength(1)
      // Drain the creation/removal frames before asserting the restore increment.
      expect((await nextHostFrame(h.host)).payload.type).toBe('host/session-added')
      expect((await nextHostFrame(h.host)).payload.type).toBe('host/session-removed')

      const restoredFrame = nextHostFrame(h.host)
      const restored = await h.api.sessions.restore(request({ sessionId }))
      expect(restored.result).toMatchObject({ ok: true, value: { restored: true } })
      expect((await restoredFrame).payload).toMatchObject({
        type: 'host/session-restored',
        sessionId,
        cwd: h.root,
        // The durable title rides the frame so the restored row comes back
        // named without a client list refresh.
        title: '实验记录',
      })

      // Back on the visible list; the trash is empty; ordinary history is servable again
      // (the attached session's in-memory log is the harness's, so only the ok result is asserted).
      const listed = expectOk(await h.api.sessions.list(request({}))).items.map(item => item.sessionId)
      expect(listed).toContain(sessionId)
      expect(expectOk(await h.api.sessions.listTrashed(request({}))).items).toHaveLength(0)
      expect((await h.api.sessions.history(request({ sessionId }))).result.ok).toBe(true)

      // Restoring again fails: the row is no longer in the trash.
      const again = await h.api.sessions.restore(request({ sessionId }))
      expect(again.result).toMatchObject({ ok: false, error: { code: 'session-not-found' } })
    } finally {
      await h.dispose()
    }
  })
})

describe('session.purge', () => {
  it('removes the durable log and the trash row', async () => {
    const h = await harness()
    try {
      const sessionId = SessionId('session-purge-me')
      expectOk(await h.api.sessions.create(request({ sessionId, cwd: h.root })))
      await h.persistence.create({ version: 0, id: sessionId, createdAt: Date.now(), cwd: h.root } as SessionHeader)
      await h.persistence.append(sessionId, seedConversation())
      expectOk(await h.api.sessions.trash(request({ sessionId })))

      // Materialize the artifact file purge will remove.
      const header = (await h.persistence.list()).find(item => item.id === sessionId)
      const location = h.persistence.locate(header!)
      writeFileSync(location.path, 'durable log bytes')

      const purged = await h.api.sessions.purge(request({ sessionId }))
      expect(purged.result).toMatchObject({ ok: true, value: { purged: true } })
      expect(existsSync(location.path)).toBe(false)
      expect(expectOk(await h.api.sessions.listTrashed(request({}))).items).toHaveLength(0)

      // The trash preview now refuses the id.
      const preview = await h.api.sessions.trashHistory(request({ sessionId }))
      expect(preview.result).toMatchObject({ ok: false, error: { code: 'session-not-found' } })
    } finally {
      await h.dispose()
    }
  })
})

describe('session.trashHistory', () => {
  it('serves the empty page for a trashed session whose backend never materialized an artifact', async () => {
    const h = await harness()
    try {
      // A created-but-never-appended session: the header map knows it, the
      // trash index row exists, but there is no artifact to read.
      const sessionId = SessionId('session-empty-artifact')
      expectOk(await h.api.sessions.create(request({ sessionId, cwd: h.root })))
      await h.persistence.create({ version: 0, id: sessionId, createdAt: Date.now(), cwd: h.root } as SessionHeader)
      expectOk(await h.api.sessions.trash(request({ sessionId })))
      expect(expectOk(await h.api.sessions.listTrashed(request({}))).items).toHaveLength(1)

      const preview = expectOk(await h.api.sessions.trashHistory(request({ sessionId })))
      expect(preview.events).toEqual([])
      expect(preview.hasMore).toBe(false)
    } finally {
      await h.dispose()
    }
  })
})

describe('session.listTrashed retention', () => {
  it('sweeps entries older than the retention window before listing', async () => {
    const h = await harness()
    try {
      const oldId = SessionId('session-expired')
      const freshId = SessionId('session-fresh')
      const headerOf = (id: SessionId): SessionHeader =>
        ({ version: 0, id, createdAt: Date.now(), cwd: h.root })
      await h.persistence.create(headerOf(oldId))
      await h.persistence.create(headerOf(freshId))
      await h.trash.add({
        sessionId: oldId,
        deletedAt: Date.now() - SESSION_TRASH_RETENTION_MS - 60_000,
        blank: false,
        workspaceIds: [],
      })
      await h.trash.add({
        sessionId: freshId,
        deletedAt: Date.now() - 60_000,
        blank: false,
        workspaceIds: [],
      })
      // Both logs exist on disk; the sweep must destroy only the expired one.
      writeFileSync(join(h.root, `${oldId}.jsonl`), 'old log')
      writeFileSync(join(h.root, `${freshId}.jsonl`), 'fresh log')

      const items = expectOk(await h.api.sessions.listTrashed(request({}))).items
      expect(items.map(item => item.sessionId)).toEqual([freshId])
      expect(existsSync(join(h.root, `${oldId}.jsonl`))).toBe(false)
      expect(existsSync(join(h.root, `${freshId}.jsonl`))).toBe(true)
    } finally {
      await h.dispose()
    }
  })
})

