/**
 * Runtime seam stamper: the Harness stylesheet keys off stable data-* hooks
 * (`data-dsh-harness-frame`, `data-dsh-harness-sidebar`, …). This module
 * stamps them onto the matching elements at runtime so the skin works with
 * zero base-package edits. Each selector uses only stable attributes already
 * present in the stock UI (`data-composer-card`) or lightningcss-preserved
 * class-name substrings. Stamps are idempotent and inert without the
 * `data-dsh-harness` root attribute (the whole stylesheet is gated on it), so
 * they stay in place when the skin flips off — "off" still renders the exact
 * stock UI.
 * @module @deepseek-ai/dsh-client-ui-harness
 */

interface Seam {
  /** Attribute to stamp (bare name; value is always ''). */
  readonly attribute: string
  /** CSS selector for the element(s) to stamp. */
  readonly selector: string
  /** Stamp only the first (topmost) match, not every descendant match. */
  readonly first?: boolean
}

const SEAMS: readonly Seam[] = [
  // The layout frame: the sidebar column's direct parent.
  { attribute: 'data-dsh-harness-frame', selector: ':has(> [class*="sidebarCol"])' },
  // The sidebar content root (topmost `root` under the column).
  { attribute: 'data-dsh-harness-sidebar', selector: '[class*="sidebarCol"] [class*="root"]', first: true },
  // Details panel (topmost `root` under the details column).
  { attribute: 'data-dsh-harness-details', selector: '[class*="detailsCol"] [class*="root"]', first: true },
  // Composer card (stock data attribute).
  { attribute: 'data-dsh-harness-composer', selector: '[data-composer-card]' },
  // The header (frosted bar over the transcript).
  { attribute: 'data-dsh-harness-header', selector: 'header', first: true },
]

function stamp(seam: Seam): void {
  if (seam.first) {
    const el = document.querySelector(seam.selector)
    if (el !== null && !el.hasAttribute(seam.attribute)) el.setAttribute(seam.attribute, '')
    return
  }
  for (const el of document.querySelectorAll(seam.selector)) {
    if (!el.hasAttribute(seam.attribute)) el.setAttribute(seam.attribute, '')
  }
}

function stampAll(): void {
  for (const seam of SEAMS) stamp(seam)
}

/**
 * Stamp the seams once, then keep them stamped as React remounts nodes.
 * @returns a disposer that disconnects the observer.
 */
export function startSeamStamper(): () => void {
  stampAll()
  const observer = new MutationObserver(() => { stampAll() })
  observer.observe(document.documentElement, { childList: true, subtree: true })
  return () => { observer.disconnect() }
}
