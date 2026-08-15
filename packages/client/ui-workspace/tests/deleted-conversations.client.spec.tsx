// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type {
  HistoryEntry, SessionId, SessionListState, TrashedSession, WorkspaceListState,
} from '@deepseek-ai/dsh-client-runtime/client'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { zh as commonZh } from '@deepseek-ai/dsh-client-locale/src/locales/zh.ts'
import type { DeletedConversationsSectionProps } from '../src/client/contract/slots.ts'
import { DeletedConversationsSection } from '../src/client/DeletedConversationsSection.tsx'
import { zh } from '../src/client/locales.ts'

afterEach(cleanup)

const t: DeletedConversationsSectionProps['t'] = makeTranslate(zh, commonZh)

const sid = (id: string) => id as SessionId

const emptySessions: SessionListState = {
  ids: [], byId: {}, current: undefined, phase: 'ready',
  subagentsByParent: {}, jobsBySession: {}, currentAddress: undefined,
}
const emptyWorkspaces: WorkspaceListState = {
  items: [], archivedSessionIds: [], state: 'idle', phase: 'ready', error: null, baselinesReady: true,
  recentWorkspaceId: undefined,
}
function hook<T>(snapshot: T) {
  return function select<S>(selector: (state: T) => S): S { return selector(snapshot) }
}

const entry = (id: string, overrides: Partial<TrashedSession> = {}): TrashedSession => ({
  sessionId: sid(id),
  deletedAt: Date.now() - 24 * 60 * 60 * 1000,
  ...(overrides.title === undefined ? { title: `对话 ${id}` } : {}),
  ...overrides,
})

const event = (type: string, seq: number, data: unknown): HistoryEntry =>
  ({ event: { type, seq, time: seq, data } as never })

function mount(overrides: Partial<DeletedConversationsSectionProps> = {}) {
  const listTrashed = vi.fn(async () => [entry('a'), entry('b', { title: '', cwd: '/projects/实验' })])
  const trashHistory = vi.fn(async () => ({
    events: [
      event('user/message', 1, { content: [{ type: 'text', text: '帮我写代码' }] }),
      event('assistant/message', 2, { message: { content: [{ type: 'text', text: '好的，看这里' }] } }),
      event('tool/call', 3, { callId: 'c1', name: 'bash', arguments: '{"cmd":"ls"}' }),
      event('tool/result', 4, { callId: 'c1', message: { content: [{ type: 'text', text: 'file.txt' }] } }),
    ],
    hasMore: false,
  }))
  const restore = vi.fn(async () => {})
  const purge = vi.fn(async () => {})
  const props: DeletedConversationsSectionProps = {
    close: vi.fn(),
    useSessions: hook(emptySessions),
    useWorkspaces: hook(emptyWorkspaces),
    listTrashed,
    trashHistory,
    restore,
    purge,
    t,
    ...overrides,
  }
  const view = render(<DeletedConversationsSection {...props} />)
  return { view, props, listTrashed, trashHistory, restore, purge }
}

describe('DeletedConversationsSection', () => {
  it('lists trashed sessions with title, deletion moment, and remaining retention', async () => {
    const { listTrashed } = mount()
    await waitFor(() => { expect(listTrashed).toHaveBeenCalledOnce() })
    expect(screen.getByText('对话 a')).toBeTruthy()
    // Fallback title: cwd basename.
    expect(screen.getByText('实验')).toBeTruthy()
    expect(screen.getAllByText(/删除于/).length).toBe(2)
    expect(screen.getAllByText(/天后自动永久删除/).length).toBe(2)
  })

  it('renders the empty state', async () => {
    mount({ listTrashed: vi.fn(async () => []) })
    await waitFor(() => { expect(screen.getByText('回收站为空')).toBeTruthy() })
  })

  it('opens a read-only preview with folded messages and tool rows, and goes back', async () => {
    const { trashHistory } = mount()
    await waitFor(() => { expect(screen.getByText('对话 a')).toBeTruthy() })
    fireEvent.click(screen.getAllByText('预览对话')[0]!)
    await waitFor(() => { expect(trashHistory).toHaveBeenCalledWith(sid('a'), undefined, undefined) })
    expect(screen.getByText('帮我写代码')).toBeTruthy()
    expect(screen.getByText('好的，看这里')).toBeTruthy()
    expect(screen.getByText('调用工具 bash')).toBeTruthy()
    expect(screen.getByText('file.txt')).toBeTruthy()
    fireEvent.click(screen.getByText('返回列表'))
    expect(screen.getByText('对话 a')).toBeTruthy()
  })

  it('restores a session, shows the notice, and refreshes the list', async () => {
    const { restore, listTrashed } = mount()
    await waitFor(() => { expect(screen.getByText('对话 a')).toBeTruthy() })
    fireEvent.click(screen.getAllByText('恢复')[0]!)
    await waitFor(() => { expect(restore).toHaveBeenCalledWith(sid('a')) })
    await waitFor(() => { expect(listTrashed).toHaveBeenCalledTimes(2) })
    expect(screen.getByText('已恢复')).toBeTruthy()
  })

  it('confirms permanent deletion in the red dialog, then refreshes', async () => {
    const { purge, listTrashed } = mount()
    await waitFor(() => { expect(screen.getByText('对话 a')).toBeTruthy() })
    fireEvent.click(screen.getAllByText('永久删除')[0]!)
    const dialog = screen.getByRole('dialog', { name: '永久删除该对话？' })
    expect(within(dialog).getByText(/彻底删除，无法恢复/)).toBeTruthy()
    fireEvent.click(within(dialog).getByText('永久删除'))
    await waitFor(() => { expect(purge).toHaveBeenCalledWith(sid('a')) })
    await waitFor(() => { expect(listTrashed).toHaveBeenCalledTimes(2) })
    expect(screen.queryByRole('dialog', { name: '永久删除该对话？' })).toBeNull()
  })

  it('keeps the purge dialog open with the error on failure', async () => {
    const purge = vi.fn(async () => { throw new Error('磁盘写入失败') })
    mount({ purge })
    await waitFor(() => { expect(screen.getByText('对话 a')).toBeTruthy() })
    fireEvent.click(screen.getAllByText('永久删除')[0]!)
    fireEvent.click(within(screen.getByRole('dialog', { name: '永久删除该对话？' })).getByText('永久删除'))
    await waitFor(() => { expect(screen.getByText(/永久删除失败/)).toBeTruthy() })
    expect(screen.getByRole('dialog', { name: '永久删除该对话？' })).toBeTruthy()
  })

  it('shows the load error when listing fails', async () => {
    mount({ listTrashed: vi.fn(async () => { throw new Error('连接断开') }) })
    await waitFor(() => { expect(screen.getByText(/加载已删除对话失败/)).toBeTruthy() })
  })
})
