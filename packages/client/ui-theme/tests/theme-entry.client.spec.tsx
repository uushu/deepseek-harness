// @vitest-environment jsdom
/** ThemeEntry（侧栏主题入口）行为：图标-only 触发（无文字）、点击弹出
 * 四个主题菜单、选中态跟随持久化偏好、选择驱动 setTheme 并关闭。 */
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

  it('opens the menu listing the four preferences', () => {
    mount()
    fireEvent.click(screen.getByRole('button', { name: 'Appearance' }))
    for (const label of ['Light', 'Dark', 'System', 'Harness']) {
      expect(screen.getByRole('menuitem', { name: label })).toBeDefined()
    }
  })

  it('selecting an option drives setTheme and closes the menu', () => {
    const b = mount('dark')
    fireEvent.click(screen.getByRole('button', { name: 'Appearance' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Harness' }))
    expect(b.setTheme).toHaveBeenCalledWith('harness')
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('marks the current preference as selected', () => {
    mount('system')
    fireEvent.click(screen.getByRole('button', { name: 'Appearance' }))
    // Menu 的选中标记是尾随 check（.selected 行类），非 aria-checked。
    expect(screen.getByRole('menuitem', { name: 'System' }).className).toContain('selected')
    expect(screen.getByRole('menuitem', { name: 'Dark' }).className).not.toContain('selected')
  })

  it('selection follows the store mirror, not the click echo', () => {
    const b = mount('dark')
    const trigger = screen.getByRole('button', { name: 'Appearance' })
    fireEvent.click(trigger)
    fireEvent.click(screen.getByRole('menuitem', { name: 'Light' }))
    expect(b.setTheme).toHaveBeenCalledWith('light')
    // 选择后菜单关闭；重开时 store 尚未同步，旧选中仍为 Dark。
    fireEvent.click(trigger)
    expect(screen.getByRole('menuitem', { name: 'Dark' }).className).toContain('selected')
    act(() => { b.store.actions.sync('light', 1) })
    // store 同步后选中移到 Light（无需重开菜单）。
    expect(screen.getByRole('menuitem', { name: 'Light' }).className).toContain('selected')
  })
})
