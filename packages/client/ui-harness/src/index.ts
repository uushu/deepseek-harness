/**
 * Node half of the Harness skin plugin: an intentional no-op (the loader
 * manages the client face; nothing host-side runs for a visual skin).
 * @module @deepseek-ai/dsh-client-ui-harness
 */

/**
 * No-op Host half.
 */
export function apply(): void {
  /* loader-managed lifecycle only */
}
