/**
 * Host-rendered theme bootstrap for the browser's pre-plugin interval. Each
 * index response embeds the current durable built-in preference; the browser
 * resolves only `system`, then writes the same DOM fields ui-layout's
 * ThemePresenter owns after the client plugin tree activates. The `harness`
 * preference additionally inlines its alias-token overrides on body so the
 * first paint already wears the Harness palette (no dark→harness flash).
 */

import { HARNESS_THEME_ID, HARNESS_TOKENS } from './harness-theme.ts'
import { DEFAULT_PREFERENCE, type ThemePreference } from './theme-settings.ts'

/** Build the inline script for one schema-validated built-in preference. */
function bootThemeScript(preference: ThemePreference): string {
  const harness = preference === HARNESS_THEME_ID
  const tokens = harness ? JSON.stringify(HARNESS_TOKENS) : 'null'
  return `<script>(() => {
  const preference = ${JSON.stringify(preference)}
  const systemDark = preference === 'system'
    && typeof matchMedia !== 'undefined'
    && matchMedia('(prefers-color-scheme: dark)').matches
  const dark = preference === 'dark' || preference === 'harness' || systemDark
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
  document.body.toggleAttribute('data-ds-dark-theme', dark)
  // 主题身份：harness 专属 presentation CSS 以此为准（与 dark 基础色板分离）。
  document.body.setAttribute('data-ds-theme', preference === 'system' ? (dark ? 'dark' : 'light') : preference)
  const tokens = ${tokens}
  if (tokens) for (const [name, value] of Object.entries(tokens)) {
    document.body.style.setProperty(name, value)
  }
})()</script>`
}

/**
 * Insert the theme bootstrap immediately after the opening body tag, before
 * the shell mount and module script. Body-less fragments receive it at the
 * end, where the HTML parser has already synthesized a body.
 * @param html - Raw application index HTML.
 * @param preference - Current Host-backed built-in preference.
 * @returns HTML containing the theme bootstrap.
 */
export function injectBootTheme(
  html: string,
  preference: ThemePreference = DEFAULT_PREFERENCE,
): string {
  const script = bootThemeScript(preference)
  const body = /<body(?:\s[^>]*)?>/i.exec(html)
  if (body === null) return `${html}${script}`
  const at = body.index + body[0].length
  return `${html.slice(0, at)}${script}${html.slice(at)}`
}
