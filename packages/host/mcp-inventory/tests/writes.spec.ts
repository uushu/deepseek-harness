import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { parse } from 'yaml'
import { Context } from '@deepseek-ai/cordis'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import { DSH_HOME_ENV } from '@deepseek-ai/dsh-home-paths'
import { homePatchPath, readHomePatchEntries, writeHomePatchEntries } from '../src/patch-store.ts'
import { validateServerConfig } from '../src/config.ts'
import { McpInventoryGateway } from '../src/index.ts'

const HOME_PATCH_FILENAME = 'cordis.patch.yml'

const previousHome = process.env[DSH_HOME_ENV]
const homes: string[] = []

/** Point the home patch layer at a fresh temp directory for one test. */
function useHome(): string {
  const home = mkdtempSync(join(tmpdir(), 'dsh-mcp-home-'))
  homes.push(home)
  process.env[DSH_HOME_ENV] = home
  return home
}

afterEach(() => {
  if (previousHome === undefined) Reflect.deleteProperty(process.env, DSH_HOME_ENV)
  else process.env[DSH_HOME_ENV] = previousHome
  for (const home of homes.splice(0)) rmSync(home, { recursive: true, force: true })
})

/** A mounted gateway whose write side needs no Loader entries. */
async function gateway(): Promise<McpInventoryGateway> {
  const ctx = new Context()
  await ctx.plugin(Loader)
  await ctx.plugin(McpInventoryGateway)
  return ctx.get('mcpInventory') as McpInventoryGateway
}

describe('McpInventoryGateway upsert', () => {
  it('creates a stdio server entry in the home patch layer and projects it back', async () => {
    useHome()
    const inventory = await gateway()

    const view = inventory.upsert({
      transport: 'stdio',
      serverName: 'fs',
      command: 'node',
      args: ['server.mjs'],
      env: { TOKEN: 'secret' },
      cwd: '/srv',
      toolCallTimeoutMs: 30_000,
      reconnect: { enabled: true, initialDelayMs: 100 },
    })

    expect(view).toMatchObject({
      entryId: 'mcp-fs',
      serverName: 'fs',
      transport: 'stdio',
      enabled: true,
      fiberPhase: null,
      command: 'node',
      args: ['server.mjs'],
      envKeys: ['TOKEN'],
      cwd: '/srv',
      toolCallTimeoutMs: 30_000,
      reconnect: { enabled: true, initialDelayMs: 100 },
    })
    const raw = readFileSync(homePatchPath(), 'utf8')
    expect(raw).toContain('mcp-fs')
    // Secret values never ride the response, but the patch file stores them.
    expect(JSON.stringify(view)).not.toContain('secret')
    expect(raw).toContain('TOKEN: secret')
    const entries = readHomePatchEntries()
    expect(entries).toEqual([
      {
        id: 'mcp-fs',
        name: '@deepseek-ai/dsh-mcp-client',
        config: expect.objectContaining({ transport: 'stdio', serverName: 'fs', command: 'node' }) as Record<string, unknown>,
      },
    ])
  })

  it('replaces the existing entry for a serverName and keeps foreign rows', async () => {
    const home = useHome()
    writeFileSync(join(home, HOME_PATCH_FILENAME), [
      '- id: other-plugin',
      "  name: '@deepseek-ai/dsh-example'",
      '  config: { keep: true }',
      '- id: mcp-http',
      "  name: '@deepseek-ai/dsh-mcp-client'",
      '  config: { transport: streamable-http, serverName: remote, url: https://old }',
      '- id: mcp-fs',
      "  name: '@deepseek-ai/dsh-mcp-client'",
      '  config: { transport: stdio, serverName: fs, command: node }',
    ].join('\n'), 'utf8')
    const inventory = await gateway()

    const view = inventory.upsert({
      transport: 'streamable-http',
      serverName: 'remote',
      url: 'https://new.example.com/sse',
    })

    expect(view).toMatchObject({ entryId: 'mcp-http', serverName: 'remote', transport: 'streamable-http' })
    const entries = readHomePatchEntries()
    expect(entries).toHaveLength(3)
    expect(entries[0]).toEqual({ id: 'other-plugin', name: '@deepseek-ai/dsh-example', config: { keep: true } })
    expect(entries[1]).toEqual({
      id: 'mcp-http',
      name: '@deepseek-ai/dsh-mcp-client',
      config: expect.objectContaining({ transport: 'streamable-http', serverName: 'remote', url: 'https://new.example.com/sse' }) as Record<string, unknown>,
    })
    expect(entries[2]).toMatchObject({ id: 'mcp-fs', name: '@deepseek-ai/dsh-mcp-client' })
  })

  it('rejects an id collision with a non-MCP entry', async () => {
    useHome()
    const inventory = await gateway()
    writeFileSync(join(homePatchPath()), [
      '- id: mcp-fs',
      "  name: '@deepseek-ai/dsh-something-else'",
    ].join('\n'), 'utf8')

    expect(() => inventory.upsert({ transport: 'stdio', serverName: 'fs', command: 'node' }))
      .toThrow('already used by a non-MCP plugin')
  })

  it('keeps stored secret values when the editor submits an empty placeholder', async () => {
    const home = useHome()
    writeFileSync(join(home, HOME_PATCH_FILENAME), [
      '- id: mcp-fs',
      "  name: '@deepseek-ai/dsh-mcp-client'",
      '  config: { transport: stdio, serverName: fs, command: node, env: { KEEP: old-value, DROP: bye } }',
    ].join('\n'), 'utf8')
    const inventory = await gateway()

    // An empty submitted value keeps the stored one; a key the editor removed
    // (absent from the submission) is dropped.
    const view = inventory.upsert({
      transport: 'stdio',
      serverName: 'fs',
      command: 'node',
      env: { KEEP: '', NEW: 'hello' },
    })

    expect(view).toMatchObject({ envKeys: ['KEEP', 'NEW'] })
    const raw = readFileSync(homePatchPath(), 'utf8')
    expect(raw).toContain('KEEP: old-value')
    expect(raw).toContain('NEW: hello')
    expect(raw).not.toContain('DROP')
  })

  it('keeps only string secrets and drops an all-empty submission', async () => {
    const home = useHome()
    writeFileSync(join(home, HOME_PATCH_FILENAME), [
      '- id: mcp-fs',
      "  name: '@deepseek-ai/dsh-mcp-client'",
      '  config: { transport: stdio, serverName: fs, command: node, env: { KEEP: 123 } }',
    ].join('\n'), 'utf8')
    const inventory = await gateway()

    // The stored KEEP is a number, so the empty placeholder cannot keep it; a
    // key with no stored value at all (GHOST) merges to an empty map, which
    // drops the env block entirely.
    const kept = inventory.upsert({
      transport: 'stdio',
      serverName: 'fs',
      command: 'node',
      env: { KEEP: '', GHOST: '' },
    })
    expect(kept).not.toHaveProperty('envKeys')
    expect(JSON.stringify(readHomePatchEntries())).not.toContain('env')

    const merged = inventory.upsert({
      transport: 'stdio',
      serverName: 'fs',
      command: 'node',
      env: { KEEP: '', NEW: 'hello' },
    })
    expect(merged).toMatchObject({ envKeys: ['NEW'] })
    expect(readFileSync(homePatchPath(), 'utf8')).not.toContain('KEEP')
  })

  it('omits the env block entirely when the editor sends no env', async () => {
    useHome()
    const inventory = await gateway()
    const view = inventory.upsert({ transport: 'stdio', serverName: 'plain', command: 'node' })
    expect(view).toMatchObject({ entryId: 'mcp-plain', serverName: 'plain' })
    expect(view).not.toHaveProperty('envKeys')
    expect(JSON.stringify(readHomePatchEntries())).not.toContain('env')
  })

  it('merges stored http headers the same way and persists them', async () => {
    const home = useHome()
    writeFileSync(join(home, HOME_PATCH_FILENAME), [
      '- id: mcp-http',
      "  name: '@deepseek-ai/dsh-mcp-client'",
      '  config: { transport: streamable-http, serverName: remote, url: https://x, headers: { AUTH: old-token, DROP: bye } }',
    ].join('\n'), 'utf8')
    const inventory = await gateway()

    const view = inventory.upsert({
      transport: 'streamable-http',
      serverName: 'remote',
      url: 'https://x',
      headers: { AUTH: '', NEW: 'Bearer y' },
    })

    expect(view).toMatchObject({ headerKeys: ['AUTH', 'NEW'] })
    const raw = readFileSync(homePatchPath(), 'utf8')
    expect(raw).toContain('AUTH: old-token')
    expect(raw).toContain('NEW: Bearer y')
    expect(raw).not.toContain('DROP')
  })
})

describe('McpInventoryGateway removeServer', () => {
  it('removes the matching server and reports whether one existed', async () => {
    const home = useHome()
    writeFileSync(join(home, HOME_PATCH_FILENAME), [
      '- id: mcp-fs',
      "  name: '@deepseek-ai/dsh-mcp-client'",
      '  config: { transport: stdio, serverName: fs, command: node }',
      '- id: other-plugin',
      "  name: '@deepseek-ai/dsh-example'",
    ].join('\n'), 'utf8')
    const inventory = await gateway()

    expect(inventory.removeServer('fs')).toEqual({ removed: true })
    expect(inventory.removeServer('fs')).toEqual({ removed: false })
    const entries = readHomePatchEntries()
    expect(entries).toEqual([{ id: 'other-plugin', name: '@deepseek-ai/dsh-example' }])
    expect(existsSync(homePatchPath())).toBe(true)
  })
})

describe('validateServerConfig', () => {
  it('normalizes and rejects invalid inputs', () => {
    expect(() => validateServerConfig(null)).toThrow('config must be an object')
    expect(() => validateServerConfig({ transport: 'udp', serverName: 'x', command: 'c' })).toThrow('transport')
    expect(() => validateServerConfig({ transport: 'stdio', serverName: 'BAD NAME', command: 'c' })).toThrow('serverName')
    expect(() => validateServerConfig({ transport: 'stdio', serverName: 'x' })).toThrow('requires a command')
    expect(() => validateServerConfig({ transport: 'streamable-http', serverName: 'x' })).toThrow('requires a url')
    expect(() => validateServerConfig({ transport: 'stdio', serverName: 'x', command: 'c', env: { K: 42 } }))
      .toThrow('env.K must be a string')
    expect(() => validateServerConfig({ transport: 'stdio', serverName: 'x', command: 'c', env: 'nope' }))
      .toThrow('env must be a string map')
    expect(() => validateServerConfig({ transport: 'stdio', serverName: 'x', command: 'c', args: [1] }))
      .toThrow('args must be a string list')
    expect(() => validateServerConfig({ transport: 'stdio', serverName: 'x', command: 'c', args: 'nope' }))
      .toThrow('args must be a string list')
    expect(() => validateServerConfig({ transport: 'stdio', serverName: 'x', command: 'c', cwd: 42 }))
      .toThrow('cwd must be a string')
    expect(() => validateServerConfig({ transport: 'stdio', serverName: 'x', command: 'c', failOnStartupError: 'yes' }))
      .toThrow('failOnStartupError must be a boolean')
    expect(() => validateServerConfig({ transport: 'stdio', serverName: 'x', command: 'c', reconnect: 'yes' }))
      .toThrow('reconnect must be an object')
    expect(() => validateServerConfig({ transport: 'stdio', serverName: 'x', command: 'c', toolCallTimeoutMs: -1 }))
      .toThrow('positive integer')
    expect(() => validateServerConfig({ transport: 'stdio', serverName: 42, command: 'c' }))
      .toThrow('serverName')
    expect(() => validateServerConfig({ transport: 'stdio', serverName: 'x', command: 'c', reconnect: { enabled: 'yes' } }))
      .toThrow('reconnect.enabled must be a boolean')

    expect(validateServerConfig({ transport: 'stdio', serverName: 'fs', command: 'node' }))
      .toEqual({ transport: 'stdio', serverName: 'fs', command: 'node' })
    // A whitespace-only cwd and blank optional fields are omitted, not stored.
    expect(validateServerConfig({ transport: 'stdio', serverName: 'fs', command: 'node', cwd: '   ' }))
      .toEqual({ transport: 'stdio', serverName: 'fs', command: 'node' })
    // Reconnect delays are kept only when present.
    expect(validateServerConfig({ transport: 'stdio', serverName: 'fs', command: 'node', reconnect: { enabled: true, maxDelayMs: 500 } }))
      .toEqual({ transport: 'stdio', serverName: 'fs', command: 'node', reconnect: { enabled: true, maxDelayMs: 500 } })
    expect(validateServerConfig({ transport: 'stdio', serverName: 'fs', command: 'node', reconnect: { enabled: true, maxAttempts: 3 } }))
      .toEqual({ transport: 'stdio', serverName: 'fs', command: 'node', reconnect: { enabled: true, maxAttempts: 3 } })
    expect(validateServerConfig({
      transport: 'streamable-http',
      serverName: 'fs',
      url: 'https://x',
      headers: { A: 'b' },
      failOnStartupError: false,
    }))
      .toEqual({
        transport: 'streamable-http',
        serverName: 'fs',
        url: 'https://x',
        headers: { A: 'b' },
        failOnStartupError: false,
      })
  })
})

describe('patch-store round trips', () => {
  it('parses the yaml document and writes it back atomically', () => {
    const home = useHome()
    writeFileSync(join(home, HOME_PATCH_FILENAME), [
      '- id: a',
      "  name: '@deepseek-ai/dsh-a'",
      '  config:',
      '    nested: { list: [1, 2] }',
      '- id: b',
      "  name: 'cordis:plain'",
    ].join('\n'), 'utf8')

    const entries = readHomePatchEntries()
    expect(entries).toEqual([
      { id: 'a', name: '@deepseek-ai/dsh-a', config: { nested: { list: [1, 2] } } },
      { id: 'b', name: 'cordis:plain' },
    ])
    expect(parse(readFileSync(homePatchPath(), 'utf8'))).toEqual([
      { id: 'a', name: '@deepseek-ai/dsh-a', config: { nested: { list: [1, 2] } } },
      { id: 'b', name: 'cordis:plain' },
    ])
  })

  it('yields an empty list for a missing or empty file', () => {
    const home = useHome()
    expect(readHomePatchEntries()).toEqual([])
    writeFileSync(join(home, HOME_PATCH_FILENAME), '', 'utf8')
    expect(readHomePatchEntries()).toEqual([])
  })

  it('rethrows a non-ENOENT read failure', () => {
    const home = useHome()
    // A directory where the patch file should be: readFileSync fails with EISDIR.
    mkdirSync(join(home, HOME_PATCH_FILENAME))
    expect(() => readHomePatchEntries()).toThrow()
  })

  it('rejects a document that is not an entry list', () => {
    const home = useHome()
    writeFileSync(join(home, HOME_PATCH_FILENAME), 'just a string', 'utf8')
    expect(() => readHomePatchEntries()).toThrow(/not an entry list/)
  })

  it('skips rows that are not objects or lack id/name', () => {
    const home = useHome()
    writeFileSync(join(home, HOME_PATCH_FILENAME), [
      '- 42',
      '- config: {}',
      '- id: a',
      "  name: '@deepseek-ai/dsh-a'",
    ].join('\n'), 'utf8')
    expect(readHomePatchEntries()).toEqual([{ id: 'a', name: '@deepseek-ai/dsh-a' }])
  })

  it('flattens insert rows and preserves foreign and malformed rows on write', () => {
    const home = useHome()
    writeFileSync(join(home, HOME_PATCH_FILENAME), [
      '- 42',
      '- insert:',
      '    - 7',
      '    - id: group-child',
      '      group: true',
      '- insert:',
      '    - id: foreign-child',
      "      name: '@deepseek-ai/dsh-example'",
      '    - id: mcp-a',
      "      name: '@deepseek-ai/dsh-mcp-client'",
      '      config: { transport: stdio, serverName: a, command: node }',
      '- id: mcp-group',
      '  insert:',
      '    - id: mcp-c',
      "      name: '@deepseek-ai/dsh-mcp-client'",
      '- id: odd',
      '  name: 42',
      '- id: mcp-b',
      "  name: '@deepseek-ai/dsh-mcp-client'",
      '  config: { transport: stdio, serverName: b, command: node }',
    ].join('\n'), 'utf8')

    expect(readHomePatchEntries().map(entry => entry.id)).toEqual(
      ['group-child', 'foreign-child', 'mcp-a', 'mcp-c', 'odd', 'mcp-b'],
    )
    expect(readHomePatchEntries().find(entry => entry.id === 'odd')).toEqual({ id: 'odd', name: '' })

    // Rewriting keeps scalar/foreign/group rows and re-emits the MCP rows as
    // their own insert lists (mcp-a and the mcp-group child are dropped).
    writeHomePatchEntries([
      { id: 'mcp-b', name: '@deepseek-ai/dsh-mcp-client', config: { transport: 'stdio', serverName: 'b', command: 'node' } },
      { id: 'mcp-empty', name: '@deepseek-ai/dsh-mcp-client' },
    ])
    const raw = readFileSync(homePatchPath(), 'utf8')
    expect(raw).toContain('- 42')
    expect(raw).toContain('- 7')
    expect(raw).toContain('foreign-child')
    expect(raw).toContain('group-child')
    expect(raw).toContain('odd')
    expect(raw).toContain('mcp-b')
    expect(raw).toContain('mcp-empty')
    expect(raw).not.toContain('mcp-a')
    expect(readHomePatchEntries().map(entry => entry.id)).toEqual(
      ['group-child', 'foreign-child', 'odd', 'mcp-b', 'mcp-empty'],
    )
  })
})
