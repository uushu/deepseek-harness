// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { McpInventorySnapshot } from '@deepseek-ai/dsh-api-remotes/client'
import { McpConfigTab, type McpConfigTabInjected, type McpConfigTabProps } from '../src/client/McpConfigTab.tsx'
import { McpInventoryTab, type McpInventoryTabInjected, type McpInventoryTabProps } from '../src/client/McpInventoryTab.tsx'
import { en, type McpSettingsLocaleKey } from '../src/client/locales.ts'

afterEach(cleanup)

type Snapshot = McpInventorySnapshot
const t = ((key: McpSettingsLocaleKey): string => en[key]) as McpConfigTabProps['t']

function configProps(list: McpConfigTabInjected['list']): McpConfigTabProps {
  return { t, list } as McpConfigTabProps
}

function inventoryProps(list: McpInventoryTabInjected['list']): McpInventoryTabProps {
  return { t, list } as McpInventoryTabProps
}

const SNAPSHOT = {
  entries: [
    {
      entryId: 'mcp-fs', serverName: 'fs', transport: 'stdio', enabled: true, fiberPhase: 'active',
      command: 'node', args: ['server.mjs'], envKeys: ['TOKEN'], cwd: '/srv',
      toolCallTimeoutMs: 30_000, failOnStartupError: true,
      reconnect: { enabled: true, initialDelayMs: 100, maxDelayMs: 5000, maxAttempts: 10 },
    },
    {
      entryId: 'mcp-http', serverName: 'remote', transport: 'streamable-http', enabled: true, fiberPhase: 'failed',
      url: 'https://mcp.example.com/sse', headerKeys: ['Authorization'],
      reconnect: { enabled: false },
    },
    { entryId: 'mcp-off', serverName: 'off', transport: 'stdio', enabled: false, fiberPhase: null, command: 'node' },
    { entryId: 'mcp-extra', serverName: 'extra', transport: 'stdio', enabled: true, fiberPhase: null, command: 'node', failOnStartupError: false, reconnect: { enabled: true, initialDelayMs: 200 } },
    { entryId: 'mcp-malformed', enabled: true, fiberPhase: 'loading' },
  ],
} as unknown as Snapshot

describe('McpConfigTab', () => {
  it('renders redacted resolved config with runtime status only for enabled servers', async () => {
    const deferred = Promise.withResolvers<Snapshot>()
    const list = vi.fn(() => deferred.promise)
    const view = render(<McpConfigTab {...configProps(list)} />)
    expect(screen.getByText(en.loading)).toBeTruthy()

    await act(async () => { deferred.resolve(SNAPSHOT) })
    expect(list).toHaveBeenCalledOnce()
    expect(screen.getAllByRole('listitem')).toHaveLength(5)
    expect(screen.getAllByText(en.enabledTag)).toHaveLength(4)
    expect(screen.getByText(en.disabledTag)).toBeTruthy()
    expect(screen.getAllByText(en.transportStdio)).toHaveLength(3)
    expect(screen.getByText(en.transportHttp)).toBeTruthy()
    for (const value of ['Mounted', 'Mount failed', 'Loading', 'Not mounted']) {
      expect(screen.getByRole('img', { name: value })).toBeTruthy()
    }
    // The malformed entry keeps only identity fields and an unparsed title.
    expect(screen.getByText(en.unparsed)).toBeTruthy()

    const fsCard = screen.getByRole('button', { name: 'fs, stdio process, Enabled' })
    expect(fsCard.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(fsCard)
    expect(fsCard.getAttribute('aria-expanded')).toBe('true')
    expect(view.container.querySelector('[data-loader-entry]')?.textContent).toBe('mcp-fs')
    expect(screen.getByText(en.cordis)).toBeTruthy()
    for (const [label, value] of [
      [en.command, 'node'], [en.args, 'server.mjs'], [en.envKeys, 'TOKEN'], [en.cwd, '/srv'],
      [en.toolCallTimeoutMs, '30000'], [en.failOnStartupError, en.enabledTag],
      [en.initialDelayMs, '100'], [en.maxDelayMs, '5000'], [en.maxAttempts, '10'],
    ] as Array<[string, string]>) {
      expect(screen.getByText(label).nextElementSibling?.textContent).toBe(value)
    }
    // The enabled reconnect row renders the same copy in both cells.
    expect(screen.getAllByText(en.reconnect)).toHaveLength(2)
    fireEvent.click(fsCard)
    expect(view.container.querySelector('[data-loader-entry]')).toBeNull()

    const httpCard = screen.getByRole('button', { name: 'remote, Streamable HTTP, Enabled' })
    fireEvent.click(httpCard)
    expect(screen.getByText(en.url).nextElementSibling?.textContent).toBe('https://mcp.example.com/sse')
    expect(screen.getByText(en.headerKeys).nextElementSibling?.textContent).toBe('Authorization')
    expect(screen.getByText(en.reconnect).nextElementSibling?.textContent).toBe(en.reconnectDisabled)

    const disabled = screen.getByRole('button', { name: 'off, stdio process, Disabled' })
    fireEvent.click(disabled)
    expect(screen.queryByText(en.cordis)).toBeNull()
    // The disabled card itself carries no runtime status dot.
    expect(view.container.querySelector('[data-mcp-server="mcp-off"] [role="img"]')).toBeNull()

    // A server with partial reconnect settings and startup-failure disabled
    // renders only the fields that are present.
    const extra = screen.getByRole('button', { name: 'extra, stdio process, Enabled' })
    fireEvent.click(extra)
    expect(screen.getByText(en.failOnStartupError).nextElementSibling?.textContent).toBe(en.disabledTag)
    expect(screen.getByText(en.initialDelayMs).nextElementSibling?.textContent).toBe('200')
    expect(screen.queryByText(en.maxDelayMs)).toBeNull()
    expect(screen.queryByText(en.maxAttempts)).toBeNull()
  })

  it('shows a generic failure and retries into the empty state', async () => {
    const list = vi.fn<McpConfigTabInjected['list']>()
      .mockRejectedValueOnce(new Error('private transport detail'))
      .mockResolvedValueOnce({ entries: [] })
    render(<McpConfigTab {...configProps(list)} />)

    expect((await screen.findByRole('alert')).textContent).toBe(en.error)
    expect(screen.queryByText('private transport detail')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: en.retry }))
    await waitFor(() => { expect(list).toHaveBeenCalledTimes(2) })
    expect(await screen.findByText(en.empty)).toBeTruthy()
  })

  it('contains a synchronous Remote failure and ignores a result after unmount', async () => {
    const syncFailure = vi.fn(() => { throw new Error('namespace unavailable') }) as McpConfigTabInjected['list']
    const failed = render(<McpConfigTab {...configProps(syncFailure)} />)
    expect((await screen.findByRole('alert')).textContent).toBe(en.error)
    failed.unmount()

    const deferred = Promise.withResolvers<Snapshot>()
    const pending = render(<McpConfigTab {...configProps(() => deferred.promise)} />)
    pending.unmount()
    await act(async () => { deferred.resolve(SNAPSHOT) })

    const deferredFailure = Promise.withResolvers<Snapshot>()
    const pendingFailure = render(<McpConfigTab {...configProps(() => deferredFailure.promise)} />)
    pendingFailure.unmount()
    await act(async () => { deferredFailure.reject(new Error('late failure')) })
  })
})

describe('McpInventoryTab', () => {
  it('renders the searchable instance list with status and disclosure', async () => {
    const deferred = Promise.withResolvers<Snapshot>()
    const list = vi.fn(() => deferred.promise)
    const view = render(<McpInventoryTab {...inventoryProps(list)} />)
    expect(screen.getByText(en.loading)).toBeTruthy()

    await act(async () => { deferred.resolve(SNAPSHOT) })
    expect(list).toHaveBeenCalledOnce()
    expect(screen.getByRole('searchbox', { name: en.search })).toBeTruthy()
    expect(screen.getByRole('heading', { name: en.inventoryTab })).toBeTruthy()
    expect(view.container.querySelector('[data-mcp-count]')?.textContent).toBe('5')
    expect(screen.getAllByRole('listitem')).toHaveLength(5)
    // A missing serverName falls back to the entry id as the row title.
    expect(screen.getByRole('button', { name: 'mcp-malformed, , Enabled' })).toBeTruthy()

    const fsCard = screen.getByRole('button', { name: 'fs, stdio process, Enabled' })
    fireEvent.click(fsCard)
    expect(fsCard.getAttribute('aria-expanded')).toBe('true')
    expect(view.container.querySelector('[data-loader-entry]')?.textContent).toBe('mcp-fs')
    expect(screen.getByText(en.serverName).nextElementSibling?.textContent).toBe('fs')
    expect(screen.getByText(en.cordis)).toBeTruthy()
    fireEvent.click(fsCard)
    expect(view.container.querySelector('[data-loader-entry]')).toBeNull()

    // Expanding a config-less row reports the unparsed fallback.
    const malformed = screen.getByRole('button', { name: 'mcp-malformed, , Enabled' })
    fireEvent.click(malformed)
    expect(screen.getByText(en.serverName).nextElementSibling?.textContent).toBe(en.unparsed)
    fireEvent.click(malformed)

    // A disabled row never shows runtime status.
    const offCard = screen.getByRole('button', { name: 'off, stdio process, Disabled' })
    fireEvent.click(offCard)
    expect(screen.queryByText(en.cordis)).toBeNull()
  })

  it('filters by server name, entry id, or transport and clears disclosure on no-match', async () => {
    const view = render(<McpInventoryTab {...inventoryProps(async () => SNAPSHOT)} />)
    const search = await screen.findByRole('searchbox', { name: en.search })

    const remoteCard = screen.getByRole('button', { name: 'remote, Streamable HTTP, Enabled' })
    fireEvent.click(remoteCard)
    expect(view.container.querySelector('[data-loader-entry]')?.textContent).toBe('mcp-http')

    fireEvent.change(search, { target: { value: 'fs' } })
    expect(screen.getAllByRole('listitem')).toHaveLength(1)
    expect(view.container.querySelector('[data-loader-entry]')).toBeNull()

    fireEvent.change(search, { target: { value: 'mcp-http' } })
    expect(screen.getAllByRole('listitem')).toHaveLength(1)
    expect(screen.getByText('remote')).toBeTruthy()

    fireEvent.change(search, { target: { value: 'stdio' } })
    expect(screen.getAllByRole('listitem')).toHaveLength(3)

    fireEvent.change(search, { target: { value: 'not-a-server' } })
    expect(screen.queryAllByRole('listitem')).toHaveLength(0)
    expect(screen.getByText(en.emptySearch)).toBeTruthy()
  })

  it('shows a generic failure and retries into the empty state', async () => {
    const list = vi.fn<McpInventoryTabInjected['list']>()
      .mockRejectedValueOnce(new Error('private transport detail'))
      .mockResolvedValueOnce({ entries: [] })
    render(<McpInventoryTab {...inventoryProps(list)} />)

    expect((await screen.findByRole('alert')).textContent).toBe(en.error)
    fireEvent.click(screen.getByRole('button', { name: en.retry }))
    await waitFor(() => { expect(list).toHaveBeenCalledTimes(2) })
    expect(await screen.findByText(en.empty)).toBeTruthy()
  })

  it('contains a synchronous Remote failure and ignores a result after unmount', async () => {
    const syncFailure = vi.fn(() => { throw new Error('namespace unavailable') }) as McpInventoryTabInjected['list']
    const failed = render(<McpInventoryTab {...inventoryProps(syncFailure)} />)
    expect((await screen.findByRole('alert')).textContent).toBe(en.error)
    failed.unmount()

    const deferred = Promise.withResolvers<Snapshot>()
    const pending = render(<McpInventoryTab {...inventoryProps(() => deferred.promise)} />)
    pending.unmount()
    await act(async () => { deferred.resolve(SNAPSHOT) })

    const deferredFailure = Promise.withResolvers<Snapshot>()
    const pendingFailure = render(<McpInventoryTab {...inventoryProps(() => deferredFailure.promise)} />)
    pendingFailure.unmount()
    await act(async () => { deferredFailure.reject(new Error('late failure')) })
  })
})
