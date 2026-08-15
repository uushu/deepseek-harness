/**
 * Host-rendered theme bootstrap for the browser's pre-plugin interval. Each
 * index response embeds the current durable built-in preference; the browser
 * resolves `system`, then writes the same DOM fields and built-in theme tokens
 * ui-layout's ThemePresenter owns after the client plugin tree activates.
 */

import { OTHER_WORLD_THEME_ID, OTHER_WORLD_THEME_TOKENS } from './other-world-theme.ts'
import { DEFAULT_PREFERENCE, type ThemePreference } from './theme-settings.ts'

/** Build the inline script for one schema-validated built-in preference. */
function bootThemeScript(preference: ThemePreference): string {
  return `<script>(() => {
  const preference = ${JSON.stringify(preference)}
  const otherWorldId = ${JSON.stringify(OTHER_WORLD_THEME_ID)}
  const otherWorldTokens = ${JSON.stringify(OTHER_WORLD_THEME_TOKENS)}
  const otherWorld = preference === otherWorldId
  const systemDark = preference === 'system'
    && typeof matchMedia !== 'undefined'
    && matchMedia('(prefers-color-scheme: dark)').matches
  const dark = otherWorld || preference === 'dark' || systemDark
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
  document.body.toggleAttribute('data-ds-dark-theme', dark)
  for (const name of Object.keys(otherWorldTokens)) document.body.style.removeProperty(name)
  if (otherWorld) {
    for (const [name, value] of Object.entries(otherWorldTokens)) {
      document.body.style.setProperty(name, value)
    }
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
