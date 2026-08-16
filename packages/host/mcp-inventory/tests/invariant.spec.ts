import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it } from 'vitest'
import InvariantRegistry from '@deepseek-ai/dsh-invariants'
import * as McpInventoryInvariant from '../src/invariant.ts'

describe('mcp-inventory invariant companion', () => {
  it('registers the empty installer under the package name', async () => {
    const ctx = new Context()
    await ctx.plugin(InvariantRegistry, { enabled: true })
    await expect(ctx.plugin(McpInventoryInvariant).await()).resolves.toBeDefined()
    await ctx.fiber.dispose()
  })
})
