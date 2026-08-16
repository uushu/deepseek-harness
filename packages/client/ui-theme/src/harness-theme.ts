/**
 * 「Harness 官网风」内置主题（id `harness`）。
 *
 * 设计来源：https://www.deepseek.com/harness/en/ 的暗色设计语言 —— 纯黑
 * 页面底色（#0a0a0a）、品牌蓝（#6799fe）、半透明白色玻璃表面/描边、
 * 白底主按钮，以及 DM Sans / Montserrat / Fragment Mono 字体栈。
 *
 * 该主题叠加在 dark base palette 之上：颜色/字体/阴影全部以 alias token
 * 覆盖的形式提供（presenter 写成 body 内联变量，优先于 CSS 规则），
 * light / dark 两个既有主题完全不受影响。
 * @module @deepseek-ai/dsh-client-ui-theme
 */

/** 主题 id（Appearance 选项与持久化偏好共用）。 */
export const HARNESS_THEME_ID = 'harness' as const

/**
 * Harness 主题的 alias token 覆盖：变量名 → 单值（该主题只有 dark
 * 一个 color scheme，无需 light/dark 双值）。
 */
export const HARNESS_TOKENS: Readonly<Record<string, string>> = {
  // ---- 背景（官网 --ds-color-bg-* 暗色）----
  '--dsw-alias-bg-base': '#0a0a0a',
  '--dsw-alias-bg-layer-1': 'hsla(0, 0%, 100%, 0.06)',
  '--dsw-alias-bg-layer-2': 'hsla(0, 0%, 100%, 0.04)',
  '--dsw-alias-bg-layer-3': 'hsla(0, 0%, 100%, 0.02)',
  '--dsw-alias-bg-module-platform': 'hsla(0, 0%, 100%, 0.06)',
  '--dsw-alias-bg-multi-select': 'hsla(0, 0%, 100%, 0.04)',
  '--dsw-alias-bg-overlay': '#262626',
  '--dsw-alias-bg-mask-2': 'rgba(0, 0, 0, 0.24)',
  '--dsw-alias-bg-mask-drop': 'rgba(0, 0, 0, 0.6)',
  '--dsw-alias-bg-skeleton': 'hsla(0, 0%, 100%, 0.06)',

  // ---- 边框（官网 --ds-color-border-* 暗色）----
  '--dsw-alias-border-l1': 'hsla(0, 0%, 100%, 0.06)',
  '--dsw-alias-border-l2': 'hsla(0, 0%, 100%, 0.12)',
  '--dsw-alias-border-l2-darkmode-thin': 'hsla(0, 0%, 100%, 0.06)',
  '--dsw-alias-border-l3': 'hsla(0, 0%, 100%, 0.16)',
  '--dsw-alias-border-l4': 'hsla(0, 0%, 100%, 0.24)',

  // ---- 文字（官网 --ds-color-text-* 暗色）----
  '--dsw-alias-label-primary': '#ffffff',
  '--dsw-alias-label-primary-bluish': '#6799fe',
  '--dsw-alias-label-primary-dimmed': 'hsla(0, 0%, 100%, 0.8)',
  '--dsw-alias-label-primary-foreground': '#0a0a0a',
  '--dsw-alias-label-primary-inverted': '#0a0a0a',
  '--dsw-alias-label-secondary': 'hsla(0, 0%, 100%, 0.8)',
  '--dsw-alias-label-tertiary': 'hsla(0, 0%, 100%, 0.5)',
  '--dsw-alias-label-caption': 'hsla(0, 0%, 100%, 0.5)',
  '--dsw-alias-label-dimmed': 'hsla(0, 0%, 100%, 0.35)',

  // ---- 品牌 / 业务状态（官网 --ds-color-brand 暗色 #6799fe）----
  '--dsw-alias-brand-primary': '#6799fe',
  '--dsw-alias-brand-text': '#6799fe',
  '--dsw-alias-brand-primary-invert': '#0a0a0a',
  '--dsw-alias-state-business-primary': '#6799fe',
  '--dsw-alias-state-business-tertiary': 'rgba(103, 153, 254, 0.15)',

  // ---- 按钮（官网暗色主按钮白底黑字、次按钮玻璃）----
  '--dsw-alias-button-contrast-fill': '#ffffff',
  '--dsw-alias-button-elevated-fill': 'hsla(0, 0%, 100%, 0.1)',
  '--dsw-alias-button-floating-fill': 'hsla(0, 0%, 100%, 0.12)',
  '--dsw-alias-button-floating-hover': 'hsla(0, 0%, 100%, 0.2)',
  '--dsw-alias-button-ghost-active-border': 'hsla(0, 0%, 100%, 0.2)',
  '--dsw-alias-button-ghost-active-fill': 'hsla(0, 0%, 100%, 0.08)',
  '--dsw-alias-button-ghost-active-hover': 'hsla(0, 0%, 100%, 0.12)',
  '--dsw-alias-button-info-fill': '#6799fe',
  '--dsw-alias-button-info-hover': '#7fabff',
  '--dsw-alias-button-primary-dimmed': 'hsla(0, 0%, 100%, 0.25)',
  '--dsw-alias-button-primary-fill': '#ffffff',
  '--dsw-alias-button-primary-hover': 'hsla(0, 0%, 100%, 0.82)',
  '--dsw-alias-button-tool-bar-fill-invisible': 'hsla(0, 0%, 100%, 0.04)',
  '--dsw-alias-button-tool-bar-fill': 'hsla(0, 0%, 100%, 0.08)',
  '--dsw-alias-button-tool-bar-hover': 'hsla(0, 0%, 100%, 0.14)',

  // ---- 交互悬停（官网 --ds-color-bg-hover 暗色）----
  '--dsw-alias-interactive-bg-active': 'hsla(0, 0%, 100%, 0.1)',
  '--dsw-alias-interactive-bg-hover-accent': 'rgba(103, 153, 254, 0.18)',
  '--dsw-alias-interactive-bg-hover-danger': 'rgba(242, 90, 90, 0.15)',
  '--dsw-alias-interactive-bg-hover-solid': 'hsla(0, 0%, 100%, 0.1)',
  '--dsw-alias-interactive-bg-hover': 'hsla(0, 0%, 100%, 0.06)',

  // ---- Markdown / 代码（官网 --ds-color-bg-code 暗色）----
  '--dsw-alias-markdown-citation': 'hsla(0, 0%, 100%, 0.06)',
  '--dsw-alias-markdown-code-block-banner': 'rgba(0, 0, 0, 0.4)',
  '--dsw-alias-markdown-code-block': 'rgba(0, 0, 0, 0.35)',
  '--dsw-alias-markdown-code-segment-selected': 'hsla(0, 0%, 100%, 0.12)',
  '--dsw-alias-markdown-code-segment-unselected': 'rgba(0, 0, 0, 0.35)',
  '--dsw-alias-markdown-inline-code': 'hsla(0, 0%, 100%, 0.1)',
  '--dsw-alias-markdown-placeholder': 'hsla(0, 0%, 100%, 0.03)',
  '--dsw-alias-markdown-tag': 'hsla(0, 0%, 100%, 0.1)',

  // ---- 会话域专用表面（气泡 / 输入 / 侧边栏）----
  '--dsw-specific-bubble-highlight': 'rgba(103, 153, 254, 0.16)',
  '--dsw-specific-bubble': 'hsla(0, 0%, 100%, 0.08)',
  '--dsw-specific-input-major': 'hsla(0, 0%, 100%, 0.08)',
  '--dsw-specific-login-input': 'rgba(0, 0, 0, 0.35)',
  '--dsw-specific-menu': '#262626',
  '--dsw-specific-selector': 'hsla(0, 0%, 100%, 0.04)',
  '--dsw-specific-sidebar-fill': 'hsla(0, 0%, 100%, 0.02)',
  '--dsw-specific-sidebar-nav-item-active-accent': 'rgba(103, 153, 254, 0.2)',
  '--dsw-specific-sidebar-nav-item-active': 'hsla(0, 0%, 100%, 0.08)',
  '--dsw-specific-sidebar-nav-item-hover': 'hsla(0, 0%, 100%, 0.05)',
  '--dsw-specific-tip': 'hsla(0, 0%, 100%, 0.04)',

  // ---- Toast / Tooltip ----
  '--dsw-alias-tooltip-bg': 'rgba(20, 20, 22, 0.95)',
  '--dsw-alias-toast-bg': 'rgba(20, 20, 22, 0.95)',

  // ---- 滚动条 ----
  '--dsw-alias-scrollbar-bg-l1': 'hsla(0, 0%, 100%, 0.16)',
  '--dsw-alias-scrollbar-bg-l2': 'hsla(0, 0%, 100%, 0.16)',
  '--dsw-alias-scrollbar-hover-l1': 'hsla(0, 0%, 100%, 0.3)',
  '--dsw-alias-scrollbar-hover-l2': 'hsla(0, 0%, 100%, 0.3)',

  // ---- 阴影（暗色玻璃 + 顶部 inset 高光，取自官网 --ds-shadow-card）----
  '--dsw-shadow-lv1': '0 2px 8px rgba(0, 0, 0, 0.4)',
  '--dsw-shadow-lv1-blur': '0 4px 16px rgba(0, 0, 0, 0.25)',
  '--dsw-shadow-lv2': '0 4px 16px rgba(0, 0, 0, 0.35), 0 2px 8px rgba(0, 0, 0, 0.3)',
  '--dsw-shadow-lv3': 'inset 0 1px 0 hsla(0, 0%, 100%, 0.12), 0 12px 40px rgba(0, 0, 0, 0.45)',

  // ---- 会话区渐变（跟随 #0a0a0a 底）----
  '--dsw-linear-gradient-think': 'linear-gradient(180deg, #0a0a0a 20.19%, rgba(10, 10, 10, 0) 100%)',
  '--dsw-linear-think-select': 'linear-gradient(180deg, hsla(0, 0%, 100%, 0.08) 20.19%, hsla(0, 0%, 100%, 0) 100%)',

  // ---- 字体（官网字体栈；正文 DM Sans、标题 Montserrat、代码 Fragment Mono）----
  '--dsw-font-family': "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Helvetica Neue', Helvetica, Arial, sans-serif",
  '--ds-font-family-code': "'Fragment Mono', 'SF Mono', 'JetBrains Mono', 'Fira Code', Consolas, 'Liberation Mono', Menlo, Courier, 'PingFang SC', 'Microsoft YaHei'",
  '--dsw-font-markdown-h1': "700 24px/34px 'Montserrat', var(--dsw-font-family)",
  '--dsw-font-markdown-h1-font-family': "'Montserrat', var(--dsw-font-family)",
  '--dsw-font-markdown-h1-font-weight': '700',
  '--dsw-font-markdown-h2': "700 22px/32px 'Montserrat', var(--dsw-font-family)",
  '--dsw-font-markdown-h2-font-family': "'Montserrat', var(--dsw-font-family)",
  '--dsw-font-markdown-h2-font-weight': '700',
  '--dsw-font-markdown-h3': "700 20px/30px 'Montserrat', var(--dsw-font-family)",
  '--dsw-font-markdown-h3-font-family': "'Montserrat', var(--dsw-font-family)",
  '--dsw-font-markdown-h3-font-weight': '700',
}
