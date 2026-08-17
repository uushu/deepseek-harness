// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { McpInventorySnapshot, McpServerView } from '@deepseek-ai/dsh-api-remotes/client'
import {
  McpConfigTab,
  type McpConfigTabInjected,
  type McpConfigTabProps,
} from '../src/client/McpConfigTab.tsx'
import { draftToConfig, emptyDraft, draftInvalid } from '../src/client/McpConfigTab.tsx'
import { McpInventoryTab, type McpInventoryTabInjected, type McpInventoryTabProps } from '../src/client/McpInventoryTab.tsx'
import { en, type McpSettingsLocaleKey } from '../src/client/locales.ts'

afterEach(cleanup)

type Snapshot = McpInventorySnapshot
const t = ((key: McpSettingsLocaleKey): string => en[key]) as McpConfigTabProps['t']

function configProps(injected: Partial<McpConfigTabInjected>): McpConfigTabProps {
  return {
    t,
    upsert: injected.upsert ?? (async () => ({ serverName: 'x' })),
  } as McpConfigTabProps
}

function inventoryProps(list: McpInventoryTabInjected['list']): McpInventoryTabProps {
  return { t, list } as McpInventoryTabProps
}

/** The blank configuration form card. */
function cardOf(view: ReturnType<typeof render>): HTMLElement {
  const card = view.container.querySelector<HTMLElement>('[data-mcp-server="new"]')
  if (card === null) throw new Error('missing config form card')
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

describe('McpConfigTab', () => {
  it('renders only the blank configuration form, never the configured servers', async () => {
    const view = render(<McpConfigTab {...configProps({})} />)

    // The config surface is a single blank form — no configured servers are
    // shown here (they live in the list tab).
    expect(view.container.querySelectorAll('[data-mcp-server]')).toHaveLength(1)
    const form = cardOf(view)
    expect((within(form).getByLabelText<HTMLInputElement>(en.serverName)).value).toBe('')
    expect((within(form).getByLabelText<HTMLInputElement>(en.command)).value).toBe('')
    expect((within(form).getByLabelText<HTMLInputElement>(en.args)).value).toBe('')
    expect(within(form).queryByRole('button', { name: en.deleteServer })).toBeNull()
  })

  it('saves a stdio server through upsert and resets the form', async () => {
    const upsert = vi.fn<McpConfigTabInjected['upsert']>().mockResolvedValue({ entryId: 'mcp-fs', serverName: 'fs', transport: 'stdio', enabled: true, fiberPhase: null } as McpServerView)
    const view = render(<McpConfigTab {...configProps({ upsert })} />)

    const form = cardOf(view)
    fireEvent.change(within(form).getByLabelText<HTMLInputElement>(en.serverName), { target: { value: 'fs' } })
    fireEvent.change(within(form).getByLabelText<HTMLInputElement>(en.command), { target: { value: 'node' } })
    fireEvent.change(within(form).getByLabelText<HTMLInputElement>(en.args), { target: { value: 'server.mjs, --port 3000' } })
    fireEvent.change(within(form).getByLabelText<HTMLInputElement>(en.cwd), { target: { value: '/srv' } })
    fireEvent.click(within(form).getByRole('button', { name: en.save }))

    await waitFor(() => {
      expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
        transport: 'stdio',
        serverName: 'fs',
        command: 'node',
        args: ['server.mjs', '--port 3000'],
        cwd: '/srv',
      }))
    })
    expect(await screen.findByText(en.saved)).toBeTruthy()
    // The form resets for the next server.
    expect((within(form).getByLabelText<HTMLInputElement>(en.serverName)).value).toBe('')
  })

  it('rejects an invalid server without calling upsert', async () => {
    const upsert = vi.fn<McpConfigTabInjected['upsert']>()
    const view = render(<McpConfigTab {...configProps({ upsert })} />)

    const form = cardOf(view)
    fireEvent.change(within(form).getByLabelText<HTMLInputElement>(en.serverName), { target: { value: 'n' } })
    fireEvent.click(within(form).getByRole('button', { name: en.save }))

    expect((await screen.findByRole('alert')).textContent).toBe(en.invalidServer)
    expect(upsert).not.toHaveBeenCalled()
  })

  it('saves a streamable-http server with headers', async () => {
    const upsert = vi.fn<McpConfigTabInjected['upsert']>().mockResolvedValue({ entryId: 'mcp-remote', serverName: 'remote', transport: 'streamable-http', enabled: true, fiberPhase: null } as McpServerView)
    const view = render(<McpConfigTab {...configProps({ upsert })} />)

    const form = cardOf(view)
    fireEvent.change(within(form).getByLabelText<HTMLInputElement>(en.serverName), { target: { value: 'remote' } })
    fireEvent.click(within(form).getByLabelText<HTMLInputElement>(en.transportHttp))
    fireEvent.change(within(form).getByLabelText<HTMLInputElement>(en.url), { target: { value: 'https://x' } })
    fireEvent.click(within(form).getByRole('button', { name: en.addRow }))
    const rows = within(form).getAllByLabelText('key')
    fireEvent.change(rows[0]!, { target: { value: 'Authorization' } })
    const secretValues = form.querySelectorAll<HTMLInputElement>('input[type="password"]')
    fireEvent.change(secretValues[0]!, { target: { value: 'Bearer x' } })
    fireEvent.click(within(form).getByRole('button', { name: en.save }))

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
    const upsert = vi.fn<McpConfigTabInjected['upsert']>().mockResolvedValue({ entryId: 'mcp-min', serverName: 'min', transport: 'stdio', enabled: true, fiberPhase: null } as McpServerView)
    const view = render(<McpConfigTab {...configProps({ upsert })} />)

    const form = cardOf(view)
    fireEvent.change(within(form).getByLabelText<HTMLInputElement>(en.serverName), { target: { value: 'min' } })
    fireEvent.change(within(form).getByLabelText<HTMLInputElement>(en.command), { target: { value: 'python' } })
    // A zero timeout parses as "unset", not a stored value.
    fireEvent.change(within(form).getByLabelText<HTMLInputElement>(en.toolCallTimeoutMs), { target: { value: '0' } })
    fireEvent.click(within(form).getByRole('button', { name: en.save }))

    await waitFor(() => {
      expect(upsert).toHaveBeenCalledWith({ transport: 'stdio', serverName: 'min', command: 'python' })
    })
  })

  it('saves reconnect enabled without delay fields', async () => {
    const upsert = vi.fn<McpConfigTabInjected['upsert']>().mockResolvedValue({ entryId: 'mcp-min', serverName: 'min', transport: 'stdio', enabled: true, fiberPhase: null } as McpServerView)
    const view = render(<McpConfigTab {...configProps({ upsert })} />)

    const form = cardOf(view)
    fireEvent.change(within(form).getByLabelText<HTMLInputElement>(en.serverName), { target: { value: 'min' } })
    fireEvent.change(within(form).getByLabelText<HTMLInputElement>(en.command), { target: { value: 'python' } })
    fireEvent.click(within(form).getByLabelText<HTMLInputElement>(en.reconnect))
    fireEvent.click(within(form).getByRole('button', { name: en.save }))

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
    const upsert = vi.fn<McpConfigTabInjected['upsert']>().mockResolvedValue({ entryId: 'mcp-fs', serverName: 'fs', transport: 'stdio', enabled: true, fiberPhase: null } as McpServerView)
    const view = render(<McpConfigTab {...configProps({ upsert })} />)

    const form = cardOf(view)
    fireEvent.change(within(form).getByLabelText<HTMLInputElement>(en.serverName), { target: { value: 'fs' } })
    fireEvent.change(within(form).getByLabelText<HTMLInputElement>(en.command), { target: { value: 'node' } })
    fireEvent.click(within(form).getByLabelText<HTMLInputElement>(en.failOnStartupError))
    fireEvent.click(within(form).getByLabelText<HTMLInputElement>(en.reconnect))
    fireEvent.change(within(form).getByLabelText<HTMLInputElement>(en.initialDelayMs), { target: { value: '250' } })
    fireEvent.change(within(form).getByLabelText<HTMLInputElement>(en.maxDelayMs), { target: { value: '9000' } })
    fireEvent.change(within(form).getByLabelText<HTMLInputElement>(en.maxAttempts), { target: { value: '20' } })
    fireEvent.click(within(form).getByRole('button', { name: en.save }))

    await waitFor(() => {
      expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
        transport: 'stdio',
        serverName: 'fs',
        command: 'node',
        failOnStartupError: true,
        reconnect: { enabled: true, initialDelayMs: 250, maxDelayMs: 9000, maxAttempts: 20 },
      }))
    })
  })

  it('drops a blank-key secret row on submit', async () => {
    const upsert = vi.fn<McpConfigTabInjected['upsert']>().mockResolvedValue({ entryId: 'mcp-fs', serverName: 'fs', transport: 'stdio', enabled: true, fiberPhase: null } as McpServerView)
    const view = render(<McpConfigTab {...configProps({ upsert })} />)

    const form = cardOf(view)
    fireEvent.change(within(form).getByLabelText<HTMLInputElement>(en.serverName), { target: { value: 'fs' } })
    fireEvent.change(within(form).getByLabelText<HTMLInputElement>(en.command), { target: { value: 'node' } })
    fireEvent.click(within(form).getByRole('button', { name: en.addRow }))
    const secretValues = form.querySelectorAll<HTMLInputElement>('input[type="password"]')
    fireEvent.change(secretValues[0]!, { target: { value: 'x' } })
    fireEvent.click(within(form).getByRole('button', { name: en.save }))

    await waitFor(() => { expect(upsert).toHaveBeenCalledTimes(1) })
    // The blank-key row is dropped, so no env block reaches the wire.
    expect(upsert.mock.calls[0]![0]).not.toHaveProperty('env')
  })

  it('removes a secret row again after adding one', async () => {
    const view = render(<McpConfigTab {...configProps({})} />)

    const form = cardOf(view)
    fireEvent.click(within(form).getByRole('button', { name: en.addRow }))
    expect(within(form).getAllByLabelText('key')).toHaveLength(1)
    fireEvent.click(within(form).getAllByRole('button', { name: en.removeRow })[0]!)
    expect(within(form).queryAllByLabelText('key')).toHaveLength(0)
  })

  it('saves a server with a timeout and an env row', async () => {
    const upsert = vi.fn<McpConfigTabInjected['upsert']>().mockResolvedValue({ entryId: 'mcp-opt', serverName: 'opt', transport: 'stdio', enabled: true, fiberPhase: null } as McpServerView)
    const view = render(<McpConfigTab {...configProps({ upsert })} />)

    const form = cardOf(view)
    fireEvent.change(within(form).getByLabelText<HTMLInputElement>(en.serverName), { target: { value: 'opt' } })
    fireEvent.change(within(form).getByLabelText<HTMLInputElement>(en.command), { target: { value: 'node' } })
    fireEvent.change(within(form).getByLabelText<HTMLInputElement>(en.toolCallTimeoutMs), { target: { value: '30000' } })
    fireEvent.click(within(form).getByRole('button', { name: en.addRow }))
    const rows = within(form).getAllByLabelText('key')
    fireEvent.change(rows[0]!, { target: { value: 'TOKEN' } })
    const secretValues = form.querySelectorAll<HTMLInputElement>('input[type="password"]')
    fireEvent.change(secretValues[0]!, { target: { value: 'secret' } })
    fireEvent.click(within(form).getByRole('button', { name: en.save }))

    await waitFor(() => {
      expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
        transport: 'stdio',
        serverName: 'opt',
        command: 'node',
        toolCallTimeoutMs: 30_000,
        env: { TOKEN: 'secret' },
      }))
    })
  })

  it('saves a streamable-http server without headers', async () => {
    const upsert = vi.fn<McpConfigTabInjected['upsert']>().mockResolvedValue({ entryId: 'mcp-http', serverName: 'remote', transport: 'streamable-http', enabled: true, fiberPhase: null } as McpServerView)
    const view = render(<McpConfigTab {...configProps({ upsert })} />)

    const form = cardOf(view)
    fireEvent.change(within(form).getByLabelText<HTMLInputElement>(en.serverName), { target: { value: 'remote' } })
    fireEvent.click(within(form).getByLabelText<HTMLInputElement>(en.transportHttp))
    fireEvent.change(within(form).getByLabelText<HTMLInputElement>(en.url), { target: { value: 'https://x' } })
    fireEvent.click(within(form).getByRole('button', { name: en.save }))

    await waitFor(() => {
      expect(upsert).toHaveBeenCalledWith({ transport: 'streamable-http', serverName: 'remote', url: 'https://x' })
    })
  })

  it('shows a generic failure notice when upsert rejects', async () => {
    const upsert = vi.fn<McpConfigTabInjected['upsert']>().mockRejectedValue(new Error('boom'))
    const view = render(<McpConfigTab {...configProps({ upsert })} />)

    const form = cardOf(view)
    fireEvent.change(within(form).getByLabelText<HTMLInputElement>(en.serverName), { target: { value: 'fs' } })
    fireEvent.change(within(form).getByLabelText<HTMLInputElement>(en.command), { target: { value: 'node' } })
    fireEvent.click(within(form).getByRole('button', { name: en.save }))

    expect(await screen.findByText(en.error)).toBeTruthy()
    expect(upsert).toHaveBeenCalledTimes(1)
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
    const view = render(<McpInventoryTab {...inventoryProps(async () => ({
      entries: [
        ...SNAPSHOT.entries,
        {
          entryId: 'mcp-http', serverName: 'remote', transport: 'streamable-http', enabled: true, fiberPhase: null,
          url: 'https://x', headerKeys: ['Authorization'],
        },
      ],
    } as unknown as Snapshot))} />)
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
  it('flags drafts missing the required fields', () => {
    expect(draftInvalid(emptyDraft())).toBe(true)
    expect(draftInvalid({ ...emptyDraft(), serverName: 'x', command: 'c' })).toBe(false)
    expect(draftInvalid({ ...emptyDraft(), serverName: 'x', transport: 'streamable-http', url: 'https://x' })).toBe(false)
  })

  it('converts a draft into the wire config omitting blanks', () => {
    expect(draftToConfig(emptyDraft())).toEqual({ transport: 'stdio', serverName: '', command: '' })
  })
})
