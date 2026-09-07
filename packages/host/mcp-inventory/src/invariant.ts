/** Package-owned invariant companion for `@deepseek-ai/dsh-host-mcp-inventory`. */
/** @module @deepseek-ai/dsh-host-mcp-inventory/invariant */

import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-host-mcp-inventory'

/** Cordis companion plugin name. */
export const name = 'mcp-inventory-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/** No runtime invariant: the gateway only reads Loader entries, never writes. */
const install: InvariantInstaller = () => {}

/** Register this package's invariant companion. */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
