// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SkillsConfigTab, type SkillsConfigTabInjected, type SkillsConfigTabProps } from '../src/client/SkillsConfigTab.tsx'
import { SkillsListTab, type SkillsListTabInjected, type SkillsListTabProps } from '../src/client/SkillsListTab.tsx'
import { en, type SkillsSettingsLocaleKey } from '../src/client/locales.ts'

afterEach(cleanup)

type Result = Awaited<ReturnType<SkillsListTabInjected['list']>>
const t = ((key: SkillsSettingsLocaleKey): string => en[key]) as SkillsListTabProps['t']

function listProps(list: SkillsListTabInjected['list']): SkillsListTabProps {
  return { t, list } as SkillsListTabProps
}

function configProps(injected: Partial<SkillsConfigTabInjected>): SkillsConfigTabProps {
  return {
    t,
    write: injected.write ?? (async () => ({ name: 'x' })),
  } as SkillsConfigTabProps
}

/** The blank new-skill configuration form. */
function cardOf(view: ReturnType<typeof render>): HTMLElement {
  const card = view.container.querySelector<HTMLElement>('[data-skill="new"]')
  if (card === null) throw new Error('missing skill config form')
  return card
}

const RESULT: Result = {
  sessionless: false,
  skills: [
    { name: 'demo', description: 'Demo skill', whenToUse: 'when demoing', modelInvocable: true, provider: 'filesystem', source: 'project-dsh' },
    { name: 'user-only', description: 'User skill', modelInvocable: false, provider: 'filesystem', source: 'user-dsh' },
    { name: 'bundled', description: 'Internal skill', modelInvocable: true, provider: 'filesystem', source: 'bundled' },
  ],
}

describe('SkillsListTab', () => {
  it('renders the catalog with invocation badges and disclosure', async () => {
    const deferred = Promise.withResolvers<Result>()
    const list = vi.fn(() => deferred.promise)
    const view = render(<SkillsListTab {...listProps(list)} />)
    expect(screen.getByText(en.loading)).toBeTruthy()

    await act(async () => { deferred.resolve(RESULT) })
    expect(list).toHaveBeenCalledOnce()
    expect(screen.getAllByRole('listitem')).toHaveLength(3)
    expect(screen.getAllByText(en.modelInvocableTag)).toHaveLength(2)
    expect(screen.getByText(en.userOnlyTag)).toBeTruthy()

    const demo = screen.getByRole('button', { name: `demo, ${en.modelInvocableTag}` })
    fireEvent.click(demo)
    expect(demo.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByText('when demoing')).toBeTruthy()
    expect(screen.getByText(en.provider).nextElementSibling?.textContent).toBe('filesystem')
    expect(screen.getByText(en.source).nextElementSibling?.textContent).toBe('project-dsh')
    fireEvent.click(demo)
    expect(view.container.querySelector('[data-skill="demo"]')?.getAttribute('data-open')).toBeNull()

    // A skill without whenToUse shows no guidance row.
    const userOnly = screen.getByRole('button', { name: `user-only, ${en.userOnlyTag}` })
    fireEvent.click(userOnly)
    expect(screen.queryByText(en.whenToUse)).toBeNull()
  })

  it('shows the sessionless and empty states', async () => {
    const view = render(<SkillsListTab {...listProps(async () => ({ sessionless: true, skills: [] }))} />)
    expect(await screen.findByText(en.noSession)).toBeTruthy()
    view.unmount()

    render(<SkillsListTab {...listProps(async () => ({ sessionless: false, skills: [] }))} />)
    expect(await screen.findByText(en.empty)).toBeTruthy()
  })

  it('shows a generic failure and retries into the empty state', async () => {
    const list = vi.fn<SkillsListTabInjected['list']>()
      .mockRejectedValueOnce(new Error('private transport detail'))
      .mockResolvedValueOnce({ sessionless: false, skills: [] })
    render(<SkillsListTab {...listProps(list)} />)

    expect((await screen.findByRole('alert')).textContent).toBe(en.error)
    fireEvent.click(screen.getByRole('button', { name: en.retry }))
    await waitFor(() => { expect(list).toHaveBeenCalledTimes(2) })
    expect(await screen.findByText(en.empty)).toBeTruthy()
  })

  it('contains a synchronous failure and ignores a result after unmount', async () => {
    const syncFailure = vi.fn(() => { throw new Error('namespace unavailable') }) as SkillsListTabInjected['list']
    const failed = render(<SkillsListTab {...listProps(syncFailure)} />)
    expect((await screen.findByRole('alert')).textContent).toBe(en.error)
    failed.unmount()

    const deferred = Promise.withResolvers<Result>()
    const pending = render(<SkillsListTab {...listProps(() => deferred.promise)} />)
    pending.unmount()
    await act(async () => { deferred.resolve(RESULT) })

    const failing = Promise.withResolvers<Result>()
    const pendingFail = render(<SkillsListTab {...listProps(() => failing.promise)} />)
    pendingFail.unmount()
    await act(async () => { failing.reject(new Error('late failure')) })
  })
})

describe('SkillsConfigTab', () => {
  it('renders only the blank new-skill form', async () => {
    const view = render(<SkillsConfigTab {...configProps({})} />)

    // The config surface is a single blank form — the catalog lives in the list.
    expect(view.container.querySelectorAll('[data-skill]')).toHaveLength(1)
    const form = cardOf(view)
    expect((within(form).getByLabelText<HTMLInputElement>(en.nameLabel)).value).toBe('')
    expect((within(form).getByLabelText<HTMLInputElement>(en.descriptionLabel)).value).toBe('')
    expect(within(form).queryByRole('button', { name: en.deleteSkill })).toBeNull()
  })

  it('saves a new skill through write and resets the form', async () => {
    const write = vi.fn<SkillsConfigTabInjected['write']>().mockResolvedValue({ name: 'fresh' })
    const view = render(<SkillsConfigTab {...configProps({ write })} />)

    const form = cardOf(view)
    fireEvent.change(within(form).getByLabelText<HTMLInputElement>(en.nameLabel), { target: { value: 'fresh' } })
    fireEvent.change(within(form).getByLabelText<HTMLInputElement>(en.descriptionLabel), { target: { value: 'A fresh skill' } })
    fireEvent.change(within(form).getByLabelText<HTMLInputElement>(en.whenToUse), { target: { value: 'when fresh' } })
    fireEvent.click(within(form).getByLabelText(en.modelInvocableTag))
    fireEvent.change(within(form).getByLabelText<HTMLInputElement>(en.contentLabel), { target: { value: 'Fresh body' } })
    fireEvent.click(within(form).getByRole('button', { name: en.save }))

    await waitFor(() => {
      expect(write).toHaveBeenCalledWith({
        name: 'fresh',
        description: 'A fresh skill',
        whenToUse: 'when fresh',
        modelInvocable: false,
        content: 'Fresh body',
      })
    })
    expect(await screen.findByText(en.saved)).toBeTruthy()
    // The form resets for the next skill.
    expect((within(form).getByLabelText<HTMLInputElement>(en.nameLabel)).value).toBe('')
  })

  it('saves a new skill without a when-to-use line', async () => {
    const write = vi.fn<SkillsConfigTabInjected['write']>().mockResolvedValue({ name: 'fresh' })
    const view = render(<SkillsConfigTab {...configProps({ write })} />)

    const form = cardOf(view)
    fireEvent.change(within(form).getByLabelText<HTMLInputElement>(en.nameLabel), { target: { value: 'fresh' } })
    fireEvent.change(within(form).getByLabelText<HTMLInputElement>(en.descriptionLabel), { target: { value: 'A fresh skill' } })
    fireEvent.change(within(form).getByLabelText<HTMLInputElement>(en.contentLabel), { target: { value: 'Fresh body' } })
    fireEvent.click(within(form).getByRole('button', { name: en.save }))

    await waitFor(() => {
      expect(write).toHaveBeenCalledWith({
        name: 'fresh',
        description: 'A fresh skill',
        modelInvocable: true,
        content: 'Fresh body',
      })
    })
  })

  it('rejects an invalid skill without calling write', async () => {
    const write = vi.fn<SkillsConfigTabInjected['write']>()
    const view = render(<SkillsConfigTab {...configProps({ write })} />)

    const form = cardOf(view)
    fireEvent.change(within(form).getByLabelText<HTMLInputElement>(en.nameLabel), { target: { value: 'only-name' } })
    fireEvent.click(within(form).getByRole('button', { name: en.save }))

    expect((await screen.findByRole('alert')).textContent).toBe(en.invalidSkill)
    expect(write).not.toHaveBeenCalled()
  })

  it('shows a generic failure notice when write rejects', async () => {
    const write = vi.fn<SkillsConfigTabInjected['write']>().mockRejectedValue(new Error('boom'))
    const view = render(<SkillsConfigTab {...configProps({ write })} />)

    const form = cardOf(view)
    fireEvent.change(within(form).getByLabelText<HTMLInputElement>(en.nameLabel), { target: { value: 'fresh' } })
    fireEvent.change(within(form).getByLabelText<HTMLInputElement>(en.descriptionLabel), { target: { value: 'd' } })
    fireEvent.click(within(form).getByRole('button', { name: en.save }))

    expect(await screen.findByText(en.error)).toBeTruthy()
    expect(write).toHaveBeenCalledTimes(1)
  })
})
