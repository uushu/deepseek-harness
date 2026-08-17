/**
 * Sidebar-foot 主题入口（皮肤选择器）：设置在设置入口旁边的图标按钮
 * （不显示文字），点击弹出四个内置偏好（浅色/深色/跟随系统/Harness）的
 * 菜单。选中态跟随持久化偏好（store 镜像，与设置内 Appearance 行同一套
 * 数据源）；Harness 自定义皮肤从此入口进入，不再放在设置的「外观」处。
 * 纯呈现：只读 store 镜像 + 调用注入的 setTheme，不持有任何业务状态。
 * @module @deepseek-ai/dsh-client-ui-theme
 */
import { useRef, useState } from 'react'
import clsx from 'clsx'
import {
  IconDarkOutline16, IconFollowsystemOutline16, IconHarnessOutline16,
  IconLightOutline16, IconPaletteOutline16, Menu, Tooltip,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { MenuEntry } from '@deepseek-ai/dsh-client-ui-primitives'
import type { GlobalStandardProps, PropsStore } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: pulls the runtime's GlobalStandardProps merge (useSessions /
// useWorkspaces standard kit) into this program.
import type {} from '@deepseek-ai/dsh-client-runtime/client'
import type { ThemePreference } from '../theme-settings.ts'
import type { ThemeKey } from './locales.ts'
import type { createAppearanceRowStore } from './settings-store.ts'
import css from './ThemeEntry.module.css'

/** 注入的业务面：主题偏好写入（t 走标准 locale seat）。 */
export interface ThemeEntryInjected {
  /** 切换主题偏好。 */
  setTheme: (id: ThemePreference) => void
}

/**
 * 完整组件 props。'sidebar.footer.action' 的槽位类型在 ui-sidebar 声明，
 * 而 ui-theme 无法引用它（tsc 项目引用成环：ui-sidebar → ui-layout →
 * ui-theme），因此此处按该槽位契约手工展开（wide owner share + 标准 kit）。
 */
export type ThemeEntryComponentProps =
  { wide: boolean }
  & PropsStore<ReturnType<typeof createAppearanceRowStore>>
  & { t: (key: ThemeKey) => string }
  & ThemeEntryInjected
  & GlobalStandardProps

/** 菜单项顺序与图标（Light/Dark/System/Harness 官网风）。 */
const OPTIONS: readonly { id: ThemePreference; labelKey: ThemeKey; Icon: typeof IconLightOutline16 }[] = [
  { id: 'light', labelKey: 'appearance.light', Icon: IconLightOutline16 },
  { id: 'dark', labelKey: 'appearance.dark', Icon: IconDarkOutline16 },
  { id: 'system', labelKey: 'appearance.system', Icon: IconFollowsystemOutline16 },
  { id: 'harness', labelKey: 'appearance.harness', Icon: IconHarnessOutline16 },
]

/**
 * 渲染侧栏主题入口（皮肤图标按钮 + 弹出菜单）。
 * @param props - 组合后的 slot props（wide 来自侧栏 owner）。
 * @returns 入口元素树。
 */
export function ThemeEntry({ wide, t, useStore, setTheme }: ThemeEntryComponentProps) {
  const preference = useStore(s => s.preference)
  const [open, setOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement | null>(null)
  const items: MenuEntry[] = OPTIONS.map(({ id, labelKey, Icon }) => ({
    id,
    label: t(labelKey),
    icon: <Icon size={16} />,
  }))
  return (
    <Menu
      open={open}
      portal
      side="top"
      align="start"
      dense
      selectedId={preference}
      items={items}
      onSelect={(id) => {
        setTheme(id as ThemePreference)
        setOpen(false)
      }}
      onClose={() => { setOpen(false) }}
      getAnchorRect={() => trigger.current?.getBoundingClientRect() ?? null}
      anchor={(
        <Tooltip label={t('appearance.title')} delayMs={500} disabled={wide}>
          <button
            ref={trigger}
            type="button"
            className={clsx(css.trigger, !wide && css.rail)}
            aria-haspopup="menu"
            aria-expanded={open}
            aria-label={t('appearance.title')}
            onClick={() => { setOpen(true) }}
          >
            <IconPaletteOutline16 size={wide ? 16 : 18} />
          </button>
        </Tooltip>
      )}
    />
  )
}
