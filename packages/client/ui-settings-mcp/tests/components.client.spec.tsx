// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { McpInventorySnapshot, McpServerView } from '@deepseek-ai/dsh-api-remotes/client'
import {
  McpConfigTab,
  type McpConfigTabInjected,
  type McpConfigTabProps,
} from '../src/client/McpConfigTab.tsx'
import { draftFromView, draftToConfig, emptyDraft, draftInvalid } from '../src/client/McpConfigTab.tsx'
import { McpInventoryTab, type McpInventoryTabInjected, type McpInventoryTabProps } from '../src/client/McpInventoryTab.tsx'
import { en, type McpSettingsLocaleKey } from '../src/client/locales.ts'

afterEach(cleanup)

type Snapshot = McpInventorySnapshot
const t = ((key: McpSettingsLocaleKey): string => en[key]) as McpConfigTabProps['t']

function configProps(injected: Partial<McpConfigTabInjected>): McpConfigTabProps {
  return {
    t,
    listConfig: injected.listConfig ?? (async () => SNAPSHOT),
    upsert: injected.upsert ?? (async () => SNAPSHOT.entries[0]!),
    removeServer: injected.removeServer ?? (async () => ({ removed: true })),
  } as McpConfigTabProps
}

function inventoryProps(list: McpInventoryTabInjected['list']): McpInventoryTabProps {
  return { t, list } as McpInventoryTabProps
}

/** The always-open form card for one server id (or 'new'). */
function cardOf(view: ReturnType<typeof render>, id: string): HTMLElement {
  const card = view.container.querySelector<HTMLElement>(`[data-mcp-server="${id}"]`)
  if (card === null) throw new Error(`missing mcp card ${id}`)
  return card
}

const SNAPSHOT = {
  entries: [
    {
      entryId: 'mcp-fs', serverName: 'fs', transport: 'stdio', enabled: true, fiberPhase: 'active',
      command: 'node', args: ['server.mjs'], envKeys: ['TOKEN'], cwd: '/srv',
      toolCallTimeoutMs: 30_000, failOnStartupError: true,
      reconnect: { enabled: true, initialDelayMs: 100, maxDelayMs: 5000, maxAttempts: 10 },
    },
    { entryId: 'mcp-off', serverName: 'off', transport: 'stdio', enabled: false, fiberPhase: null, command: 'node' },
    { entryId: 'mcp-bare', enabled: true, fiberPhase: null },
  ],
} as unknown as Snapshot

const HTTP_SNAPSHOT = {
  entries: [
    ...SNAPSHOT.entries,
    {
      entryId: 'mcp-http', serverName: 'remote', transport: 'streamable-http', enabled: true, fiberPhase: null,
      url: 'https://x', headerKeys: ['Authorization'],
    },
  ],
} as unknown as Snapshot

describe('McpConfigTab', () => {
  it('renders every configured server as an open form plus the new-server form', async () => {
    const view = render(<McpConfigTab {...configProps({})} />)
    expect(await screen.findByText('fs')).toBeTruthy()

    // No add button and no collapsed cards: every configured server shows its
    // form directly, and the new-server form is always present.
    expect(screen.queryByRole('button', { name: en.addServer })).toBeNull()
    for (const id of ['mcp-fs', 'mcp-off', 'mcp-bare', 'new']) {
      expect(view.container.querySelector(`[data-mcp-server="${id}"]`)?.getAttribute('data-open')).toBe('true')
    }

    const fs = cardOf(view, 'mcp-fs')
    expect((within(fs).getByLabelText<HTMLInputElement>(en.serverName)).value).toBe('fs')
    expect((within(fs).getByLabelText<HTMLInputElement>(en.command)).value).toBe('node')
    expect((within(fs).getByLabelText<HTMLInputElement>(en.args)).value).toBe('server.mjs')
    expect((within(fs).getByLabelText<HTMLInputElement>(en.cwd)).value).toBe('/srv')
    expect((within(fs).getByLabelText<HTMLInputElement>(en.toolCallTimeoutMs)).value).toBe('30000')
    expect((within(fs).getByLabelText<HTMLInputElement>(en.reconnect)).checked).toBe(true)
    expect((within(fs).getByLabelText<HTMLInputElement>(en.initialDelayMs)).value).toBe('100')
    expect((within(fs).getByLabelText<HTMLInputElement>(en.failOnStartupError)).checked).toBe(true)
    // Stored env key retained, secret value redacted.
    expect((within(fs).getAllByLabelText('key')[0] as HTMLInputElement).value).toBe('TOKEN')
    expect(within(fs).getAllByPlaceholderText(en.secretPlaceholder)).toHaveLength(1)

    // The new-server form starts blank.
    const fresh = cardOf(view, 'new')
    expect((within(fresh).getByLabelText<HTMLInputElement>(en.serverName)).value).toBe('')
    expect((within(fresh).getByLabelText<HTMLInputElement>(en.command)).value).toBe('')
  })

  it('shows only the new-server form when nothing is configured', async () => {
    const view = render(<McpConfigTab {...configProps({ listConfig: async () => ({ entries: [] }) })} />)
    expect(await screen.findByText(en.newServer)).toBeTruthy()
    expect(view.container.querySelector('[data-mcp-server="new"]')).toBeTruthy()
    expect(view.container.querySelectorAll('[data-mcp-server]')).toHaveLength(1)
  })

  it('renders a configured http server with stored header keys redacted', async () => {
    const view = render(<McpConfigTab {...configProps({ listConfig: async () => HTTP_SNAPSHOT })} />)
    await screen.findByText('remote')

    const http = cardOf(view, 'mcp-http')
    expect((within(http).getByLabelText<HTMLInputElement>(en.url)).value).toBe('https://x')
    expect((within(http).getAllByLabelText('key')[0] as HTMLInputElement).value).toBe('Authorization')
    expect(within(http).getAllByPlaceholderText(en.secretPlaceholder)).toHaveLength(1)
  })

  it('saves a new server through upsert and joins the local snapshot', async () => {
    const upsert = vi.fn<McpConfigTabInjected['upsert']>()
      .mockResolvedValue({ entryId: 'mcp-new', serverName: 'new', transport: 'stdio', enabled: true, fiberPhase: null, command: 'python' } as McpServerView)
    const view = render(<McpConfigTab {...configProps({ upsert })} />)
    await screen.findByText('fs')

    const fresh = cardOf(view, 'new')
    fireEvent.change(within(fresh).getByLabelText<HTMLInputElement>(en.serverName), { target: { value: 'new' } })
    fireEvent.change(within(fresh).getByLabelText<HTMLInputElement>(en.command), { target: { value: 'python' } })
    fireEvent.change(within(fresh).getByLabelText<HTMLInputElement>(en.args), { target: { value: 'server.py, --port 4000' } })
    fireEvent.change(within(fresh).getByLabelText<HTMLInputElement>(en.cwd), { target: { value: '/opt' } })
    fireEvent.click(within(fresh).getByRole('button', { name: en.save }))

    await waitFor(() => {
      expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
        transport: 'stdio',
        serverName: 'new',
        command: 'python',
        args: ['server.py', '--port 4000'],
        cwd: '/opt',
      }))
    })
    expect(await screen.findByText(en.saved)).toBeTruthy()
    // The upserted server joins the local config list.
    expect(view.container.querySelector('[data-mcp-server="mcp-new"]')).toBeTruthy()
  })

  it('rejects an invalid new server without calling upsert', async () => {
    const upsert = vi.fn<McpConfigTabInjected['upsert']>()
    const view = render(<McpConfigTab {...configProps({ upsert })} />)
    await screen.findByText('fs')

    const fresh = cardOf(view, 'new')
    fireEvent.change(within(fresh).getByLabelText<HTMLInputElement>(en.serverName), { target: { value: 'n' } })
    fireEvent.click(within(fresh).getByRole('button', { name: en.save }))

    expect((await screen.findByRole('alert')).textContent).toBe(en.invalidServer)
    expect(upsert).not.toHaveBeenCalled()
  })

  it('deletes an existing server through removeServer', async () => {
    const removeServer = vi.fn<McpConfigTabInjected['removeServer']>().mockResolvedValue({ removed: true })
    const view = render(<McpConfigTab {...configProps({ removeServer })} />)
    await screen.findByText('fs')

    fireEvent.click(within(cardOf(view, 'mcp-fs')).getByRole('button', { name: en.deleteServer }))

    await waitFor(() => { expect(removeServer).toHaveBeenCalledWith('fs') })
    expect(view.container.querySelector('[data-mcp-server="mcp-fs"]')).toBeNull()
  })

  it('deletes a server whose name is unparsed', async () => {
    const removeServer = vi.fn<McpConfigTabInjected['removeServer']>().mockResolvedValue({ removed: true })
    const view = render(<McpConfigTab {...configProps({ removeServer })} />)
    await screen.findByText('fs')

    fireEvent.click(within(cardOf(view, 'mcp-bare')).getByRole('button', { name: en.deleteServer }))

    await waitFor(() => { expect(removeServer).toHaveBeenCalledWith('') })
  })

  it('keeps stored env keys with the secret placeholder and submits new rows', async () => {
    const upsert = vi.fn<McpConfigTabInjected['upsert']>()
      .mockResolvedValue({ entryId: 'mcp-fs', serverName: 'fs', transport: 'stdio', enabled: true, fiberPhase: null } as McpServerView)
    const view = render(<McpConfigTab {...configProps({ upsert })} />)
    await screen.findByText('fs')

    const fs = cardOf(view, 'mcp-fs')
    expect((within(fs).getAllByLabelText('key')[0] as HTMLInputElement).value).toBe('TOKEN')
    expect(within(fs).getAllByPlaceholderText(en.secretPlaceholder)).toHaveLength(1)

    fireEvent.click(within(fs).getByRole('button', { name: en.addRow }))
    const rows = within(fs).getAllByLabelText('key')
    fireEvent.change(rows[1]!, { target: { value: 'DEBUG' } })
    const secretValues = fs.querySelectorAll<HTMLInputElement>('input[type="password"]')
    fireEvent.change(secretValues[1]!, { target: { value: '1' } })
    fireEvent.click(within(fs).getByRole('button', { name: en.save }))

    await waitFor(() => {
      expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
        transport: 'stdio',
        serverName: 'fs',
        env: { TOKEN: '', DEBUG: '1' },
      }))
    })
  })

  it('drops a blank-key secret row on submit', async () => {
    const upsert = vi.fn<McpConfigTabInjected['upsert']>()
      .mockResolvedValue({ entryId: 'mcp-fs', serverName: 'fs', transport: 'stdio', enabled: true, fiberPhase: null } as McpServerView)
    const view = render(<McpConfigTab {...configProps({ upsert })} />)
    await screen.findByText('fs')

    const fs = cardOf(view, 'mcp-fs')
    fireEvent.click(within(fs).getByRole('button', { name: en.addRow }))
    const secretValues = fs.querySelectorAll<HTMLInputElement>('input[type="password"]')
    fireEvent.change(secretValues[1]!, { target: { value: 'x' } })
    fireEvent.click(within(fs).getByRole('button', { name: en.save }))

    await waitFor(() => {
      expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ env: { TOKEN: '' } }))
    })
  })

  it('removes a secret row again after adding one', async () => {
    const view = render(<McpConfigTab {...configProps({})} />)
    await screen.findByText('fs')

    const fs = cardOf(view, 'mcp-fs')
    fireEvent.click(within(fs).getByRole('button', { name: en.addRow }))
    expect(within(fs).getAllByLabelText('key')).toHaveLength(2)
    fireEvent.click(within(fs).getAllByRole('button', { name: en.removeRow })[1]!)
    expect(within(fs).getAllByLabelText('key')).toHaveLength(1)
  })

  it('saves a new streamable-http server with headers', async () => {
    const upsert = vi.fn<McpConfigTabInjected['upsert']>()
      .mockResolvedValue({ entryId: 'mcp-http', serverName: 'remote', transport: 'streamable-http', enabled: true, fiberPhase: null, url: 'https://x' } as McpServerView)
    const view = render(<McpConfigTab {...configProps({ upsert })} />)
    await screen.findByText('fs')

    const fresh = cardOf(view, 'new')
    fireEvent.change(within(fresh).getByLabelText<HTMLInputElement>(en.serverName), { target: { value: 'remote' } })
    fireEvent.click(within(fresh).getByLabelText<HTMLInputElement>(en.transportHttp))
    fireEvent.change(within(fresh).getByLabelText<HTMLInputElement>(en.url), { target: { value: 'https://x' } })
    fireEvent.click(within(fresh).getByRole('button', { name: en.addRow }))
    const rows = within(fresh).getAllByLabelText('key')
    fireEvent.change(rows[0]!, { target: { value: 'Authorization' } })
    const secretValues = fresh.querySelectorAll<HTMLInputElement>('input[type="password"]')
    fireEvent.change(secretValues[0]!, { target: { value: 'Bearer x' } })
    fireEvent.click(within(fresh).getByRole('button', { name: en.save }))

    await waitFor(() => {
      expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
        transport: 'streamable-http',
        serverName: 'remote',
        url: 'https://x',
        headers: { Authorization: 'Bearer x' },
      }))
    })
  })

  it('saves a minimal stdio server omitting blank optionals', async () => {
    const upsert = vi.fn<McpConfigTabInjected['upsert']>()
      .mockResolvedValue({ entryId: 'mcp-min', serverName: 'min', transport: 'stdio', enabled: true, fiberPhase: null } as McpServerView)
    const view = render(<McpConfigTab {...configProps({ upsert })} />)
    await screen.findByText('fs')

    const fresh = cardOf(view, 'new')
    fireEvent.change(within(fresh).getByLabelText<HTMLInputElement>(en.serverName), { target: { value: 'min' } })
    fireEvent.change(within(fresh).getByLabelText<HTMLInputElement>(en.command), { target: { value: 'python' } })
    // A zero timeout parses as "unset", not a stored value.
    fireEvent.change(within(fresh).getByLabelText<HTMLInputElement>(en.toolCallTimeoutMs), { target: { value: '0' } })
    fireEvent.click(within(fresh).getByRole('button', { name: en.save }))

    await waitFor(() => {
      expect(upsert).toHaveBeenCalledWith({ transport: 'stdio', serverName: 'min', command: 'python' })
    })
  })

  it('saves reconnect enabled without delay fields', async () => {
    const upsert = vi.fn<McpConfigTabInjected['upsert']>()
      .mockResolvedValue({ entryId: 'mcp-min', serverName: 'min', transport: 'stdio', enabled: true, fiberPhase: null } as McpServerView)
    const view = render(<McpConfigTab {...configProps({ upsert })} />)
    await screen.findByText('fs')

    const fresh = cardOf(view, 'new')
    fireEvent.change(within(fresh).getByLabelText<HTMLInputElement>(en.serverName), { target: { value: 'min' } })
    fireEvent.change(within(fresh).getByLabelText<HTMLInputElement>(en.command), { target: { value: 'python' } })
    fireEvent.click(within(fresh).getByLabelText<HTMLInputElement>(en.reconnect))
    fireEvent.click(within(fresh).getByRole('button', { name: en.save }))

    await waitFor(() => {
      expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
        transport: 'stdio',
        serverName: 'min',
        command: 'python',
        reconnect: { enabled: true },
      }))
    })
  })

  it('toggles fail-on-startup and edits the reconnect delays', async () => {
    const upsert = vi.fn<McpConfigTabInjected['upsert']>()
      .mockResolvedValue({ entryId: 'mcp-fs', serverName: 'fs', transport: 'stdio', enabled: true, fiberPhase: null, command: 'node' } as McpServerView)
    const view = render(<McpConfigTab {...configProps({ upsert })} />)
    await screen.findByText('fs')

    const fs = cardOf(view, 'mcp-fs')
    // The stored server starts with fail-on-startup enabled; turn it off and
    // edit every reconnect delay field.
    fireEvent.click(within(fs).getByLabelText<HTMLInputElement>(en.failOnStartupError))
    fireEvent.change(within(fs).getByLabelText<HTMLInputElement>(en.initialDelayMs), { target: { value: '250' } })
    fireEvent.change(within(fs).getByLabelText<HTMLInputElement>(en.maxDelayMs), { target: { value: '9000' } })
    fireEvent.change(within(fs).getByLabelText<HTMLInputElement>(en.maxAttempts), { target: { value: '20' } })
    fireEvent.click(within(fs).getByRole('button', { name: en.save }))

    await waitFor(() => {
      expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
        transport: 'stdio',
        serverName: 'fs',
        command: 'node',
        reconnect: { enabled: true, initialDelayMs: 250, maxDelayMs: 9000, maxAttempts: 20 },
      }))
    })
    expect(upsert.mock.calls[0]![0]).not.toHaveProperty('failOnStartupError')
  })

  it('saves an http server without headers', async () => {
    const upsert = vi.fn<McpConfigTabInjected['upsert']>()
      .mockResolvedValue({ entryId: 'mcp-http', serverName: 'remote', transport: 'streamable-http', enabled: true, fiberPhase: null, url: 'https://x' } as McpServerView)
    const view = render(<McpConfigTab {...configProps({ upsert })} />)
    await screen.findByText('fs')

    const fresh = cardOf(view, 'new')
    fireEvent.change(within(fresh).getByLabelText<HTMLInputElement>(en.serverName), { target: { value: 'remote' } })
    fireEvent.click(within(fresh).getByLabelText<HTMLInputElement>(en.transportHttp))
    fireEvent.change(within(fresh).getByLabelText<HTMLInputElement>(en.url), { target: { value: 'https://x' } })
    fireEvent.click(within(fresh).getByRole('button', { name: en.save }))

    await waitFor(() => {
      expect(upsert).toHaveBeenCalledWith({ transport: 'streamable-http', serverName: 'remote', url: 'https://x' })
    })
  })

  it('shows a generic failure and retries into the ready state', async () => {
    const listConfig = vi.fn<McpConfigTabInjected['listConfig']>()
      .mockRejectedValueOnce(new Error('private transport detail'))
      .mockResolvedValueOnce(SNAPSHOT)
    render(<McpConfigTab {...configProps({ listConfig })} />)

    expect((await screen.findByRole('alert')).textContent).toBe(en.error)
    expect(screen.queryByText('private transport detail')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: en.retry }))
    expect(await screen.findByText('fs')).toBeTruthy()
  })

  it('contains a synchronous failure and ignores a result after unmount', async () => {
    const syncFailure = vi.fn(() => { throw new Error('namespace unavailable') }) as McpConfigTabInjected['listConfig']
    const failed = render(<McpConfigTab {...configProps({ listConfig: syncFailure })} />)
    expect((await screen.findByRole('alert')).textContent).toBe(en.error)
    failed.unmount()

    const deferred = Promise.withResolvers<Snapshot>()
    const pending = render(<McpConfigTab {...configProps({ listConfig: () => deferred.promise })} />)
    pending.unmount()
    await act(async () => { deferred.resolve(SNAPSHOT) })

    // A rejection landing after unmount must not touch the error state either.
    const failing = Promise.withResolvers<Snapshot>()
    const pendingFail = render(<McpConfigTab {...configProps({ listConfig: () => failing.promise })} />)
    pendingFail.unmount()
    await act(async () => { failing.reject(new Error('late failure')) })
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
    expect(view.container.querySelector('[data-mcp-count]')?.textContent).toBe('3')

    const fsCard = screen.getByRole('button', { name: 'fs, stdio process, Enabled' })
    fireEvent.click(fsCard)
    expect(view.container.querySelector('[data-loader-entry]')?.textContent).toBe('mcp-fs')
    fireEvent.click(fsCard)
    expect(view.container.querySelector('[data-loader-entry]')).toBeNull()
  })

  it('filters by server name, entry id, or transport and clears disclosure on no-match', async () => {
    const view = render(<McpInventoryTab {...inventoryProps(async () => SNAPSHOT)} />)
    const search = await screen.findByRole('searchbox', { name: en.search })

    const offCard = screen.getByRole('button', { name: 'off, stdio process, Disabled' })
    fireEvent.click(offCard)
    expect(view.container.querySelector('[data-loader-entry]')?.textContent).toBe('mcp-off')

    fireEvent.change(search, { target: { value: 'fs' } })
    expect(screen.getAllByRole('listitem')).toHaveLength(1)
    expect(view.container.querySelector('[data-loader-entry]')).toBeNull()

    fireEvent.change(search, { target: { value: 'mcp-off' } })
    expect(screen.getAllByRole('listitem')).toHaveLength(1)
    expect(screen.getByText('off')).toBeTruthy()

    fireEvent.change(search, { target: { value: 'stdio' } })
    expect(screen.getAllByRole('listitem')).toHaveLength(2)

    fireEvent.change(search, { target: { value: 'not-a-server' } })
    expect(screen.queryAllByRole('listitem')).toHaveLength(0)
    expect(screen.getByText(en.emptySearch)).toBeTruthy()
  })

  it('labels a streamable-http server and shows the unparsed fallback', async () => {
    const view = render(<McpInventoryTab {...inventoryProps(async () => HTTP_SNAPSHOT)} />)
    const httpCard = await screen.findByRole('button', { name: 'remote, Streamable HTTP, Enabled' })
    fireEvent.click(httpCard)
    expect(view.container.querySelector('[data-loader-entry]')?.textContent).toBe('mcp-http')

    // The bare server has no parsed serverName: the detail falls back.
    const bare = screen.getByRole('button', { name: 'mcp-bare, , Enabled' })
    fireEvent.click(bare)
    expect(screen.getByText(en.unparsed)).toBeTruthy()
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

  it('contains a synchronous failure and ignores a result after unmount', async () => {
    const syncFailure = vi.fn(() => { throw new Error('namespace unavailable') }) as McpInventoryTabInjected['list']
    const failed = render(<McpInventoryTab {...inventoryProps(syncFailure)} />)
    expect((await screen.findByRole('alert')).textContent).toBe(en.error)
    failed.unmount()

    const deferred = Promise.withResolvers<Snapshot>()
    const pending = render(<McpInventoryTab {...inventoryProps(() => deferred.promise)} />)
    pending.unmount()
    await act(async () => { deferred.resolve(SNAPSHOT) })

    const failing = Promise.withResolvers<Snapshot>()
    const pendingFail = render(<McpInventoryTab {...inventoryProps(() => failing.promise)} />)
    pendingFail.unmount()
    await act(async () => { failing.reject(new Error('late failure')) })
  })
})

describe('server draft helpers', () => {
  it('round-trips a view into a draft and back', () => {
    const draft = draftFromView(SNAPSHOT.entries[0]!)
    expect(draft).toMatchObject({
      serverName: 'fs',
      transport: 'stdio',
      command: 'node',
      args: 'server.mjs',
      envRows: [{ key: 'TOKEN', value: '', configured: true }],
      reconnectEnabled: true,
      initialDelayMs: '100',
    })
    expect(draftInvalid(draft)).toBe(false)
    expect(draftToConfig(draft)).toMatchObject({
      transport: 'stdio',
      serverName: 'fs',
      command: 'node',
      args: ['server.mjs'],
      env: { TOKEN: '' },
      reconnect: { enabled: true, initialDelayMs: 100, maxDelayMs: 5000, maxAttempts: 10 },
    })
  })

  it('flags drafts missing the required fields', () => {
    expect(draftInvalid(emptyDraft())).toBe(true)
    expect(draftInvalid({ ...emptyDraft(), serverName: 'x', command: 'c' })).toBe(false)
    expect(draftInvalid({ ...emptyDraft(), serverName: 'x', transport: 'streamable-http', url: 'https://x' })).toBe(false)
  })
})
