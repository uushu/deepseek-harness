// @vitest-environment jsdom
/** ThemeEntry（侧栏皮肤入口）行为：图标-only 触发（无文字）、菜单只含
 * Harness（深浅/跟随系统属设置「外观」行的标准主题选项）、选中态跟随
 * 持久化偏好、选择驱动 setTheme 并关闭。 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createSnapshotStore, type SessionListState, type WorkspaceListState } from '@deepseek-ai/dsh-client-runtime/client'
import { bindSnapshotSelector } from '@deepseek-ai/dsh-client-web-react'
import { ThemeEntry } from '../src/client/ThemeEntry.tsx'
import type { ThemeEntryComponentProps } from '../src/client/ThemeEntry.tsx'
import { createAppearanceRowStore } from '../src/client/settings-store.ts'
import type { ThemePreference } from '../src/client/index.ts'

afterEach(cleanup)

const COPY: Record<string, string> = {
  'appearance.title': 'Appearance',
  'appearance.light': 'Light',
  'appearance.dark': 'Dark',
  'appearance.system': 'System',
  'appearance.harness': 'Harness',
}

/** Empty global standard-kit hooks (the entry reads neither). */
function emptySessions() {
  const store = createSnapshotStore<SessionListState>(
    { ids: [], byId: {}, current: undefined, phase: 'ready', subagentsByParent: {}, jobsBySession: {}, currentAddress: undefined })
  return bindSnapshotSelector(store)
}
function emptyWorkspaces() {
  const store = createSnapshotStore<WorkspaceListState>({
    items: [], archivedSessionIds: [], state: 'idle', phase: 'ready', error: null,
    baselinesReady: true, recentWorkspaceId: undefined,
  })
  return bindSnapshotSelector(store)
}

function mount(preference: ThemePreference = 'system', wide = true) {
  // Real store instance — the sanctioned zero-machinery path for tests.
  const store = createAppearanceRowStore().create()
  store.actions.sync(preference, 0)
  const setTheme = vi.fn()
  const props: ThemeEntryComponentProps = {
    wide,
    useSessions: emptySessions(),
    useWorkspaces: emptyWorkspaces(),
    useStore: bindSnapshotSelector(store),
    actions: store.actions,
    t: (key: string) => COPY[key] ?? key,
    setTheme,
  }
  render(<ThemeEntry {...props} />)
  return { store, setTheme }
}

describe('ThemeEntry', () => {
  it('renders an icon-only trigger with no visible text', () => {
    mount()
    const trigger = screen.getByRole('button', { name: 'Appearance' })
    // 图标入口：无文字（需求：入口只显示皮肤图标，不显示文字主题）。
    expect(trigger.textContent?.trim()).toBe('')
    expect(trigger.getAttribute('aria-haspopup')).toBe('menu')
  })

  it('opens a menu listing only Harness (light/dark/system live in settings Appearance)', () => {
    mount()
    fireEvent.click(screen.getByRole('button', { name: 'Appearance' }))
    expect(screen.getByRole('menuitem', { name: 'Harness' })).toBeDefined()
    expect(screen.queryByRole('menuitem', { name: 'Light' })).toBeNull()
    expect(screen.queryByRole('menuitem', { name: 'Dark' })).toBeNull()
    expect(screen.queryByRole('menuitem', { name: 'System' })).toBeNull()
  })

  it('selecting Harness drives setTheme and closes the menu', () => {
    const b = mount('dark')
    fireEvent.click(screen.getByRole('button', { name: 'Appearance' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Harness' }))
    expect(b.setTheme).toHaveBeenCalledWith('harness')
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('marks Harness as selected when the harness preference is active', () => {
    mount('harness')
    fireEvent.click(screen.getByRole('button', { name: 'Appearance' }))
    // Menu 的选中标记是尾随 check（.selected 行类），非 aria-checked。
    expect(screen.getByRole('menuitem', { name: 'Harness' }).className).toContain('selected')
  })

  it('selection follows the store mirror, not the click echo', () => {
    const b = mount('dark')
    const trigger = screen.getByRole('button', { name: 'Appearance' })
    fireEvent.click(trigger)
    // 未选中 harness 时无勾。
    expect(screen.getByRole('menuitem', { name: 'Harness' }).className).not.toContain('selected')
    act(() => { b.store.actions.sync('harness', 1) })
    expect(screen.getByRole('menuitem', { name: 'Harness' }).className).toContain('selected')
  })
})
