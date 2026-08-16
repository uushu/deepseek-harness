// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type {
  SessionId, SessionListState, SessionSummary, WorkspaceListState, WorkspaceView,
} from '@deepseek-ai/dsh-client-runtime/client'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { zh as commonZh } from '@deepseek-ai/dsh-client-locale/src/locales/zh.ts'
import type { ArchivedConversationsSectionProps } from '../src/client/contract/slots.ts'
import { ArchivedConversationsSection } from '../src/client/ArchivedConversationsSection.tsx'
import { zh } from '../src/client/locales.ts'

afterEach(cleanup)

const t: ArchivedConversationsSectionProps['t'] = makeTranslate(zh, commonZh)

const sid = (id: string) => id as SessionId

const summary = (id: string, overrides: Partial<SessionSummary> = {}): SessionSummary => ({
  id: sid(id),
  displayTitle: `会话 ${id}`,
  updatedAt: 1000,
  blank: false,
  running: false,
  ...overrides,
})

const workspace = (id: string, sessionIds: string[]): WorkspaceView => ({
  workspaceId: id as WorkspaceView['workspaceId'],
  path: `/projects/${id}`,
  title: id,
  sessionIds: sessionIds.map(sid),
  createdAt: '0',
  updatedAt: '0',
})

function listState(byId: Record<string, SessionSummary>): SessionListState {
  return {
    ids: Object.keys(byId).map(sid),
    byId,
    current: undefined,
    phase: 'ready',
    subagentsByParent: {}, jobsBySession: {}, currentAddress: undefined,
  }
}

function workspacesState(items: WorkspaceView[], archivedSessionIds: string[]): WorkspaceListState {
  return {
    items,
    archivedSessionIds: archivedSessionIds.map(sid),
    state: 'idle',
    phase: 'ready',
    error: null,
    baselinesReady: true,
    recentWorkspaceId: undefined,
  }
}

function hook<T>(snapshot: T) {
  return function select<S>(selector: (state: T) => S): S { return selector(snapshot) }
}

function mount(
  sessions: SessionListState,
  workspaces: WorkspaceListState,
  overrides: Partial<ArchivedConversationsSectionProps> = {},
) {
  const unarchive = vi.fn(async () => {})
  const trashSession = vi.fn(async () => {})
  const props: ArchivedConversationsSectionProps = {
    close: vi.fn(),
    useSessions: hook(sessions),
    useWorkspaces: hook(workspaces),
    unarchive,
    trashSession,
    t,
    ...overrides,
  }
  const view = render(<ArchivedConversationsSection {...props} />)
  return { view, props, unarchive, trashSession }
}

describe('ArchivedConversationsSection', () => {
  it('lists archived sessions with workspace label and last-activity time, newest first', () => {
    mount(
      listState({
        old: summary('old', { updatedAt: 100 }),
        fresh: summary('fresh', { updatedAt: 300 }),
      }),
      workspacesState([workspace('proj', ['old'])], ['old', 'fresh']),
    )
    expect(screen.getByText('会话 fresh')).toBeTruthy()
    expect(screen.getByText('会话 old')).toBeTruthy()
    expect(screen.getAllByText(/最后活动于/).length).toBe(2)
    // An accounted row shows its workspace title; an unaccounted one shows Ungrouped.
    // (The meta span merges label and time into one text node, so match the prefix.)
    expect(screen.getByText(/^proj/)).toBeTruthy()
    expect(screen.getByText(/^未分组/)).toBeTruthy()
    // Newest activity leads.
    const titles = screen.getAllByText(/^会话 /).map(node => node.textContent)
    expect(titles).toEqual(['会话 fresh', '会话 old'])
  })

  it('renders the empty state', () => {
    mount(listState({}), workspacesState([], []))
    expect(screen.getByText('没有已归档的会话')).toBeTruthy()
  })

  it('unarchives a session and shows the notice', async () => {
    const { unarchive } = mount(
      listState({ a: summary('a') }),
      workspacesState([], ['a']),
    )
    fireEvent.click(screen.getByText('取消归档'))
    await waitFor(() => { expect(unarchive).toHaveBeenCalledWith(sid('a')) })
    await waitFor(() => { expect(screen.getByText('已取消归档')).toBeTruthy() })
  })

  it('shows the unarchive failure', async () => {
    mount(
      listState({ a: summary('a') }),
      workspacesState([], ['a']),
      { unarchive: vi.fn(async () => { throw new Error('存储写入失败') }) },
    )
    fireEvent.click(screen.getByText('取消归档'))
    await waitFor(() => { expect(screen.getByText(/恢复失败/)).toBeTruthy() })
  })

  it('offers the trash as an icon-only danger button per row', () => {
    mount(
      listState({ a: summary('a') }),
      workspacesState([], ['a']),
    )
    const trash = screen.getByRole('button', { name: '移入回收站' })
    expect(trash.querySelector('svg')).toBeTruthy()
    expect(trash.textContent).toBe('')
  })

  it('confirms move-to-trash in the dialog, then calls trashSession', async () => {
    const { trashSession } = mount(
      listState({ a: summary('a') }),
      workspacesState([], ['a']),
    )
    fireEvent.click(screen.getByRole('button', { name: '移入回收站' }))
    const dialog = screen.getByRole('dialog', { name: '移入回收站？' })
    expect(within(dialog).getByText(/保留 30 天/)).toBeTruthy()
    fireEvent.click(within(dialog).getByText('移入回收站'))
    await waitFor(() => { expect(trashSession).toHaveBeenCalledWith(sid('a')) })
    expect(screen.queryByRole('dialog', { name: '移入回收站？' })).toBeNull()
  })

  it('keeps the dialog open with the error when move-to-trash fails', async () => {
    mount(
      listState({ a: summary('a') }),
      workspacesState([], ['a']),
      { trashSession: vi.fn(async () => { throw new Error('服务不可用') }) },
    )
    fireEvent.click(screen.getByRole('button', { name: '移入回收站' }))
    fireEvent.click(within(screen.getByRole('dialog', { name: '移入回收站？' })).getByText('移入回收站'))
    await waitFor(() => { expect(screen.getByText(/移入回收站失败/)).toBeTruthy() })
    expect(screen.getByRole('dialog', { name: '移入回收站？' })).toBeTruthy()
  })

  it('falls back to the cwd basename and then the session id for blank titles', () => {
    mount(
      listState({
        named: summary('named', { displayTitle: '标题会话' }),
        base: summary('base', { displayTitle: '', cwd: '/projects/实验' }),
        bare: summary('bare', { displayTitle: '' }),
      }),
      workspacesState([], ['named', 'base', 'bare']),
    )
    expect(screen.getByText('标题会话')).toBeTruthy()
    expect(screen.getByText('实验')).toBeTruthy()
    expect(screen.getByText('bare')).toBeTruthy()
  })
})
