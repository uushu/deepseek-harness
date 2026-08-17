/**
 * Harness skin token layer: `{ light, dark }` pairs over the theme service's
 * override stack (every value rides both palettes, so the skin stays legible
 * when the user flips the Appearance preference). Dark = deep-sea navy glass
 * (the harness site's palette: #0a0a0a canvas, #6799fe brand, white-primary
 * buttons); light = cool white-blue glass. Translucent surfaces let the
 * ambient scene show through the frosted panes (the plugin CSS adds the blur).
 * @module @deepseek-ai/dsh-client-ui-harness
 */
import type { ThemeTokenOverrides } from '@deepseek-ai/dsh-client-ui-theme/client'

/** Scheme-invariant override value (applied to both palettes). */
const both = (value: string): { light: string; dark: string } => ({ light: value, dark: value })

/**
 * Harness skin alias-token overrides. Fonts: DM Sans body / Montserrat
 * headings / Fragment Mono code (self-hosted in fonts.module.css); the dark
 * palette matches the deepseek.com/harness site tokens.
 */
export const HARNESS_TOKEN_OVERRIDES: ThemeTokenOverrides = {
  // Typography: the harness site's font stacks.
  '--dsw-font-family': both("'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Helvetica Neue', Helvetica, Arial, sans-serif"),
  '--ds-font-family-code': both("'Fragment Mono', 'SF Mono', 'JetBrains Mono', 'Fira Code', Consolas, 'Liberation Mono', Menlo, Courier, 'PingFang SC', 'Microsoft YaHei'"),
  '--dsw-font-markdown-h1': both("700 24px/34px 'Montserrat', var(--dsw-font-family)"),
  '--dsw-font-markdown-h1-font-family': both("'Montserrat', var(--dsw-font-family)"),
  '--dsw-font-markdown-h1-font-weight': both('700'),
  '--dsw-font-markdown-h2': both("700 22px/32px 'Montserrat', var(--dsw-font-family)"),
  '--dsw-font-markdown-h2-font-family': both("'Montserrat', var(--dsw-font-family)"),
  '--dsw-font-markdown-h2-font-weight': both('700'),
  '--dsw-font-markdown-h3': both("700 20px/30px 'Montserrat', var(--dsw-font-family)"),
  '--dsw-font-markdown-h3-font-family': both("'Montserrat', var(--dsw-font-family)"),
  '--dsw-font-markdown-h3-font-weight': both('700'),

  // Backgrounds: the canvas and raised layers (translucent in dark so the
  // ambient scene breathes through the glass).
  '--dsw-alias-bg-base': { light: '#F4F8FD', dark: '#0a0a0a' },
  '--dsw-alias-bg-layer-1': { light: 'rgba(255, 255, 255, 0.72)', dark: 'rgba(13, 19, 29, 0.6)' },
  '--dsw-alias-bg-layer-2': { light: 'rgba(236, 242, 250, 0.66)', dark: 'rgba(17, 26, 39, 0.62)' },
  '--dsw-alias-bg-layer-3': { light: 'rgba(226, 235, 247, 0.6)', dark: 'rgba(22, 33, 48, 0.64)' },
  '--dsw-alias-bg-overlay': { light: '#E3EBF6', dark: '#161f2c' },
  '--dsw-alias-bg-module-platform': { light: 'rgba(255, 255, 255, 0.7)', dark: 'rgba(13, 19, 29, 0.55)' },
  '--dsw-alias-bg-multi-select': { light: 'rgba(255, 255, 255, 0.7)', dark: 'rgba(17, 26, 39, 0.6)' },
  '--dsw-alias-bg-mask-2': { light: 'rgba(19, 37, 62, 0.24)', dark: 'rgba(0, 0, 0, 0.24)' },
  '--dsw-alias-bg-mask-drop': { light: 'rgba(244, 248, 253, 0.72)', dark: 'rgba(0, 0, 0, 0.6)' },
  '--dsw-alias-bg-skeleton': { light: 'rgba(19, 45, 83, 0.08)', dark: 'hsla(0, 0%, 100%, 0.06)' },

  // Hairlines: cool, low-contrast strokes (site dark = white 6%-24%).
  '--dsw-alias-border-l1': { light: 'rgba(19, 45, 83, 0.08)', dark: 'hsla(0, 0%, 100%, 0.06)' },
  '--dsw-alias-border-l2': { light: 'rgba(19, 45, 83, 0.14)', dark: 'hsla(0, 0%, 100%, 0.12)' },
  '--dsw-alias-border-l2-darkmode-thin': { light: 'rgba(19, 45, 83, 0.1)', dark: 'hsla(0, 0%, 100%, 0.06)' },
  '--dsw-alias-border-l3': { light: 'rgba(19, 45, 83, 0.22)', dark: 'hsla(0, 0%, 100%, 0.16)' },
  '--dsw-alias-border-l4': { light: 'rgba(19, 45, 83, 0.32)', dark: 'hsla(0, 0%, 100%, 0.24)' },

  // Text ink.
  '--dsw-alias-label-primary': { light: '#13243E', dark: '#ffffff' },
  '--dsw-alias-label-primary-bluish': { light: '#2E5EB8', dark: '#6799fe' },
  '--dsw-alias-label-primary-dimmed': { light: '#1E3556', dark: 'hsla(0, 0%, 100%, 0.8)' },
  '--dsw-alias-label-primary-foreground': { light: '#FFFFFF', dark: '#0a0a0a' },
  '--dsw-alias-label-primary-inverted': { light: '#FFFFFF', dark: '#0a0a0a' },
  '--dsw-alias-label-secondary': { light: '#40597A', dark: 'hsla(0, 0%, 100%, 0.8)' },
  '--dsw-alias-label-tertiary': { light: '#5D7696', dark: 'hsla(0, 0%, 100%, 0.5)' },
  '--dsw-alias-label-caption': { light: '#7E93AC', dark: 'hsla(0, 0%, 100%, 0.5)' },
  '--dsw-alias-label-dimmed': { light: '#C9D4E2', dark: 'hsla(0, 0%, 100%, 0.35)' },

  // Brand: the site's #6799fe accent (dark); wordmark stays scheme ink.
  '--dsw-alias-brand-primary': { light: '#13243E', dark: '#6799fe' },
  '--dsw-alias-brand-text': { light: '#13243E', dark: '#6799fe' },
  '--dsw-alias-brand-primary-invert': { light: '#FFFFFF', dark: '#0a0a0a' },
  '--dsw-alias-state-business-primary': { light: '#3F76D8', dark: '#6799fe' },
  '--dsw-alias-state-business-tertiary': { light: '#DCE9FB', dark: 'rgba(103, 153, 254, 0.15)' },

  // Buttons: dark primary = white ink-on-dark (site), light primary = blue.
  '--dsw-alias-button-contrast-fill': { light: '#26364D', dark: '#ffffff' },
  '--dsw-alias-button-elevated-fill': { light: '#FFFFFF', dark: 'hsla(0, 0%, 100%, 0.1)' },
  '--dsw-alias-button-floating-fill': { light: '#FFFFFF', dark: 'hsla(0, 0%, 100%, 0.12)' },
  '--dsw-alias-button-floating-hover': { light: '#F0F5FB', dark: 'hsla(0, 0%, 100%, 0.2)' },
  '--dsw-alias-button-primary-fill': { light: '#3F76D8', dark: '#ffffff' },
  '--dsw-alias-button-primary-hover': { light: '#5C8DE0', dark: 'hsla(0, 0%, 100%, 0.82)' },
  '--dsw-alias-button-primary-dimmed': { light: '#DCE9FB', dark: 'hsla(0, 0%, 100%, 0.25)' },
  '--dsw-alias-button-info-fill': { light: '#3F76D8', dark: '#6799fe' },
  '--dsw-alias-button-info-hover': { light: '#5C8DE0', dark: '#7fabff' },
  '--dsw-alias-button-tool-bar-fill': { light: 'rgba(19, 45, 83, 0.06)', dark: 'hsla(0, 0%, 100%, 0.08)' },
  '--dsw-alias-button-tool-bar-hover': { light: 'rgba(19, 45, 83, 0.1)', dark: 'hsla(0, 0%, 100%, 0.14)' },
  '--dsw-alias-button-ghost-active-fill': { light: '#DCE7F4', dark: 'hsla(0, 0%, 100%, 0.08)' },
  '--dsw-alias-button-ghost-active-hover': { light: '#E9F0F8', dark: 'hsla(0, 0%, 100%, 0.12)' },
  '--dsw-alias-button-ghost-active-border': { light: '#8FA3BC', dark: 'hsla(0, 0%, 100%, 0.2)' },

  // Interaction fills.
  '--dsw-alias-interactive-bg-hover': { light: 'rgba(63, 118, 216, 0.08)', dark: 'hsla(0, 0%, 100%, 0.06)' },
  '--dsw-alias-interactive-bg-hover-accent': { light: 'rgba(63, 118, 216, 0.14)', dark: 'rgba(103, 153, 254, 0.18)' },
  '--dsw-alias-interactive-bg-active': { light: 'rgba(63, 118, 216, 0.2)', dark: 'hsla(0, 0%, 100%, 0.1)' },
  '--dsw-alias-interactive-bg-hover-danger': { light: 'rgba(236, 19, 19, 0.05)', dark: 'rgba(242, 90, 90, 0.15)' },
  '--dsw-alias-interactive-bg-hover-solid': { light: '#F0F5FB', dark: 'hsla(0, 0%, 100%, 0.1)' },

  // Markdown / code surfaces (site dark code = rgba(0,0,0,.35)).
  '--dsw-alias-markdown-code-block': { light: 'rgba(240, 245, 251, 0.6)', dark: 'rgba(0, 0, 0, 0.35)' },
  '--dsw-alias-markdown-code-block-banner': { light: 'rgba(245, 248, 253, 0.62)', dark: 'rgba(0, 0, 0, 0.4)' },
  '--dsw-alias-markdown-inline-code': { light: 'rgba(228, 237, 248, 0.6)', dark: 'hsla(0, 0%, 100%, 0.1)' },
  '--dsw-alias-markdown-citation': { light: 'rgba(234, 241, 249, 0.6)', dark: 'hsla(0, 0%, 100%, 0.06)' },
  '--dsw-alias-markdown-tag': { light: 'rgba(228, 237, 248, 0.6)', dark: 'hsla(0, 0%, 100%, 0.1)' },
  '--dsw-alias-markdown-placeholder': { light: 'rgba(234, 241, 249, 0.6)', dark: 'hsla(0, 0%, 100%, 0.03)' },
  '--dsw-alias-markdown-code-segment-selected': { light: '#FFFFFF', dark: 'hsla(0, 0%, 100%, 0.12)' },
  '--dsw-alias-markdown-code-segment-unselected': { light: 'rgba(240, 245, 251, 0.6)', dark: 'rgba(0, 0, 0, 0.35)' },

  // Scrollbars.
  '--dsw-alias-scrollbar-bg-l1': { light: 'rgba(63, 118, 216, 0.28)', dark: 'hsla(0, 0%, 100%, 0.16)' },
  '--dsw-alias-scrollbar-bg-l2': { light: 'rgba(63, 118, 216, 0.4)', dark: 'hsla(0, 0%, 100%, 0.16)' },
  '--dsw-alias-scrollbar-hover-l1': { light: 'rgba(63, 118, 216, 0.5)', dark: 'hsla(0, 0%, 100%, 0.3)' },
  '--dsw-alias-scrollbar-hover-l2': { light: 'rgba(63, 118, 216, 0.6)', dark: 'hsla(0, 0%, 100%, 0.3)' },

  // Specific surfaces: translucent so the glass + ambient show through.
  '--dsw-specific-sidebar-fill': { light: 'transparent', dark: 'transparent' },
  '--dsw-specific-sidebar-nav-item-active': { light: '#DEE9F8', dark: 'hsla(0, 0%, 100%, 0.08)' },
  '--dsw-specific-sidebar-nav-item-hover': { light: '#E9F0F8', dark: 'hsla(0, 0%, 100%, 0.05)' },
  '--dsw-specific-sidebar-nav-item-active-accent': { light: '#3F76D8', dark: 'rgba(103, 153, 254, 0.2)' },
  '--dsw-specific-input-major': { light: 'rgba(255, 255, 255, 0.6)', dark: 'rgba(10, 18, 29, 0.55)' },
  '--dsw-specific-login-input': { light: 'rgba(240, 245, 251, 0.6)', dark: 'rgba(0, 0, 0, 0.35)' },
  '--dsw-specific-menu': { light: 'rgba(234, 241, 249, 0.92)', dark: 'rgba(17, 26, 39, 0.94)' },
  '--dsw-specific-selector': { light: 'rgba(234, 241, 249, 0.6)', dark: 'hsla(0, 0%, 100%, 0.04)' },
  '--dsw-specific-bubble': { light: 'rgba(240, 245, 252, 0.6)', dark: 'rgba(17, 32, 52, 0.72)' },
  '--dsw-specific-bubble-highlight': { light: 'rgba(220, 233, 251, 0.6)', dark: 'rgba(24, 46, 76, 0.84)' },
  '--dsw-specific-tip': { light: 'rgba(234, 241, 249, 0.6)', dark: 'hsla(0, 0%, 100%, 0.04)' },
  '--dsw-alias-toast-bg': { light: '#1B3256', dark: 'rgba(20, 20, 22, 0.95)' },
  '--dsw-alias-tooltip-bg': { light: '#13243E', dark: 'rgba(20, 20, 22, 0.95)' },

  // Elevation shadows: blue-tinted depth in light, deep drop in dark.
  '--dsw-shadow-lv1': { light: '0 2px 4px rgba(19, 45, 83, 0.06)', dark: '0 2px 8px rgba(0, 0, 0, 0.4)' },
  '--dsw-shadow-lv1-blur': { light: '0 4px 12px rgba(19, 45, 83, 0.05)', dark: '0 4px 16px rgba(0, 0, 0, 0.25)' },
  '--dsw-shadow-lv2': {
    light: '0 4px 12px rgba(19, 45, 83, 0.05), 0 2px 8px rgba(19, 45, 83, 0.06)',
    dark: '0 4px 16px rgba(0, 0, 0, 0.35), 0 2px 8px rgba(0, 0, 0, 0.3)',
  },
  '--dsw-shadow-lv3': {
    light: 'inset 0 1px 0 rgba(255, 255, 255, 0.8), 0 12px 32px rgba(19, 45, 83, 0.12)',
    dark: 'inset 0 1px 0 hsla(0, 0%, 100%, 0.12), 0 12px 40px rgba(0, 0, 0, 0.45)',
  },
}
