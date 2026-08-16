// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SkillsConfigTab, type SkillsConfigTabInjected, type SkillsConfigTabProps } from '../src/client/SkillsConfigTab.tsx'
import { SkillsListTab, type SkillsListTabInjected, type SkillsListTabProps } from '../src/client/SkillsListTab.tsx'
import { groupSkills } from '../src/client/SkillsConfigTab.tsx'
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
    list: injected.list ?? (async () => RESULT),
    read: injected.read ?? (async () => 'body content'),
    write: injected.write ?? (async () => ({ name: 'x' })),
    remove: injected.remove ?? (async () => ({ removed: true })),
  } as SkillsConfigTabProps
}

const RESULT: Result = {
  sessionless: false,
  skills: [
    { name: 'demo', description: 'Demo skill', whenToUse: 'when demoing', modelInvocable: true, provider: 'filesystem', source: 'project-dsh' },
    { name: 'user-only', description: 'User skill', modelInvocable: false, provider: 'filesystem', source: 'user-dsh' },
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
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
    expect(screen.getAllByText(en.modelInvocableTag)).toHaveLength(1)
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
  it('groups skills by provider and source with editable cards', async () => {
    const deferred = Promise.withResolvers<Result>()
    const list = vi.fn(() => deferred.promise)
    render(<SkillsConfigTab {...configProps({ list })} />)
    expect(screen.getByText(en.loading)).toBeTruthy()

    await act(async () => { deferred.resolve(RESULT) })
    expect(list).toHaveBeenCalledOnce()
    expect(screen.getByRole('button', { name: en.addSkill })).toBeTruthy()
    expect(screen.getAllByText('filesystem')).toHaveLength(2)
    expect(screen.getByText('project-dsh')).toBeTruthy()
    expect(screen.getAllByRole('listitem')).toHaveLength(2)

    const demo = screen.getByRole('button', { name: `demo, ${en.modelInvocableTag}` })
    fireEvent.click(demo)
    expect(demo.getAttribute('aria-expanded')).toBe('true')
    expect((screen.getByLabelText<HTMLInputElement>(en.nameLabel)).value).toBe('demo')
    expect((screen.getByLabelText<HTMLInputElement>(en.descriptionLabel)).value).toBe('Demo skill')
    expect((screen.getByLabelText<HTMLInputElement>(en.whenToUse)).value).toBe('when demoing')
    expect((screen.getByLabelText<HTMLInputElement>(en.modelInvocableTag)).checked).toBe(true)
    // The body loads asynchronously after expand.
    expect(await screen.findByDisplayValue('body content')).toBeTruthy()
    // Clicking the open card again collapses it.
    fireEvent.click(screen.getByRole('button', { name: `demo, ${en.modelInvocableTag}` }))
    expect(screen.getByRole('button', { name: `demo, ${en.modelInvocableTag}` }).getAttribute('aria-expanded')).toBe('false')
  })

  it('handles a body read failure without crashing', async () => {
    const read = vi.fn<SkillsConfigTabInjected['read']>().mockRejectedValue(new Error('read exploded'))
    render(<SkillsConfigTab {...configProps({ read })} />)
    await screen.findByText('demo')

    fireEvent.click(screen.getByRole('button', { name: `demo, ${en.modelInvocableTag}` }))
    await waitFor(() => { expect(read).toHaveBeenCalledWith('demo') })
    // The failure path clears the loading flag and the form stays usable.
    expect((screen.getByLabelText<HTMLInputElement>(en.nameLabel)).value).toBe('demo')
  })

  it('saves an edited existing skill through write', async () => {
    const write = vi.fn<SkillsConfigTabInjected['write']>().mockResolvedValue({ name: 'demo' })
    render(<SkillsConfigTab {...configProps({ write })} />)
    await screen.findByText('demo')

    fireEvent.click(screen.getByRole('button', { name: `demo, ${en.modelInvocableTag}` }))
    fireEvent.change(screen.getByLabelText<HTMLInputElement>(en.descriptionLabel), { target: { value: 'Updated' } })
    fireEvent.click(screen.getByRole('button', { name: en.save }))

    await waitFor(() => {
      expect(write).toHaveBeenCalledWith(expect.objectContaining({ name: 'demo', description: 'Updated' }))
    })
  })

  it('saves a new skill without a when-to-use line', async () => {
    const write = vi.fn<SkillsConfigTabInjected['write']>().mockResolvedValue({ name: 'fresh' })
    render(<SkillsConfigTab {...configProps({ write })} />)
    await screen.findByText('demo')

    fireEvent.click(screen.getByRole('button', { name: en.addSkill }))
    fireEvent.change(screen.getByLabelText<HTMLInputElement>(en.nameLabel), { target: { value: 'fresh' } })
    fireEvent.change(screen.getByLabelText<HTMLInputElement>(en.descriptionLabel), { target: { value: 'A fresh skill' } })
    fireEvent.change(screen.getByLabelText<HTMLInputElement>(en.contentLabel), { target: { value: 'Fresh body' } })
    fireEvent.click(screen.getByRole('button', { name: en.save }))

    await waitFor(() => {
      expect(write).toHaveBeenCalledWith({
        name: 'fresh',
        description: 'A fresh skill',
        modelInvocable: true,
        content: 'Fresh body',
      })
    })
  })

  it('closes the new-skill card from its header', async () => {
    const view = render(<SkillsConfigTab {...configProps({})} />)
    await screen.findByText('demo')

    fireEvent.click(screen.getByRole('button', { name: en.addSkill }))
    const newCard = view.container.querySelector<HTMLElement>('[data-skill="new"]')
    expect(newCard?.getAttribute('data-open')).toBe('true')
    fireEvent.click(newCard!.querySelector('button')!)
    expect(view.container.querySelector('[data-skill="new"]')).toBeNull()
  })

  it('saves a new skill through write and refreshes', async () => {
    const write = vi.fn<SkillsConfigTabInjected['write']>().mockResolvedValue({ name: 'fresh' })
    render(<SkillsConfigTab {...configProps({ write })} />)
    await screen.findByText('demo')

    fireEvent.click(screen.getByRole('button', { name: en.addSkill }))
    fireEvent.change(screen.getByLabelText(en.nameLabel), { target: { value: 'fresh' } })
    fireEvent.change(screen.getByLabelText(en.descriptionLabel), { target: { value: 'A fresh skill' } })
    fireEvent.change(screen.getByLabelText(en.whenToUse), { target: { value: 'when fresh' } })
    fireEvent.click(screen.getByLabelText(en.modelInvocableTag))
    fireEvent.change(screen.getByLabelText(en.contentLabel), { target: { value: 'Fresh body' } })
    fireEvent.click(screen.getByRole('button', { name: en.save }))

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
  })

  it('rejects an invalid new skill without calling write', async () => {
    const write = vi.fn<SkillsConfigTabInjected['write']>()
    render(<SkillsConfigTab {...configProps({ write })} />)
    await screen.findByText('demo')

    fireEvent.click(screen.getByRole('button', { name: en.addSkill }))
    fireEvent.change(screen.getByLabelText(en.nameLabel), { target: { value: 'only-name' } })
    fireEvent.click(screen.getByRole('button', { name: en.save }))

    expect((await screen.findByRole('alert')).textContent).toBe(en.invalidSkill)
    expect(write).not.toHaveBeenCalled()
  })

  it('deletes an existing skill through remove', async () => {
    const remove = vi.fn<SkillsConfigTabInjected['remove']>().mockResolvedValue({ removed: true })
    render(<SkillsConfigTab {...configProps({ remove })} />)
    await screen.findByText('demo')

    fireEvent.click(screen.getByRole('button', { name: `demo, ${en.modelInvocableTag}` }))
    fireEvent.click(screen.getByRole('button', { name: en.deleteSkill }))

    await waitFor(() => { expect(remove).toHaveBeenCalledWith('demo') })
  })

  it('shows the sessionless and empty states and fails loudly with retry', async () => {
    const sessionless = render(<SkillsConfigTab {...configProps({ list: async () => ({ sessionless: true, skills: [] }) })} />)
    expect(await screen.findByText(en.noSession)).toBeTruthy()
    sessionless.unmount()

    const empty = render(<SkillsConfigTab {...configProps({ list: async () => ({ sessionless: false, skills: [] }) })} />)
    expect(await screen.findByText(en.empty)).toBeTruthy()
    empty.unmount()

    const list = vi.fn<SkillsConfigTabInjected['list']>()
      .mockRejectedValueOnce(new Error('private transport detail'))
      .mockResolvedValueOnce({ sessionless: false, skills: [] })
    render(<SkillsConfigTab {...configProps({ list })} />)
    expect((await screen.findByRole('alert')).textContent).toBe(en.error)
    fireEvent.click(screen.getByRole('button', { name: en.retry }))
    await waitFor(() => { expect(list).toHaveBeenCalledTimes(2) })
    expect(await screen.findByText(en.empty)).toBeTruthy()
  })

  it('contains a synchronous failure and ignores a result after unmount', async () => {
    const syncFailure = vi.fn(() => { throw new Error('namespace unavailable') }) as SkillsConfigTabInjected['list']
    const failed = render(<SkillsConfigTab {...configProps({ list: syncFailure })} />)
    expect((await screen.findByRole('alert')).textContent).toBe(en.error)
    failed.unmount()

    const deferred = Promise.withResolvers<Result>()
    const pending = render(<SkillsConfigTab {...configProps({ list: () => deferred.promise })} />)
    pending.unmount()
    await act(async () => { deferred.resolve(RESULT) })

    // A rejection landing after unmount must not touch the error state either.
    const failing = Promise.withResolvers<Result>()
    const pendingFail = render(<SkillsConfigTab {...configProps({ list: () => failing.promise })} />)
    pendingFail.unmount()
    await act(async () => { failing.reject(new Error('late failure')) })
  })
})

describe('groupSkills', () => {
  it('merges same-pair skills into one ordered group', () => {
    const groups = groupSkills([
      { name: 'b', description: 'b', modelInvocable: true, provider: 'filesystem', source: 'project-dsh' },
      { name: 'a', description: 'a', modelInvocable: true, provider: 'filesystem', source: 'project-dsh' },
      { name: 'c', description: 'c', modelInvocable: true, provider: 'runtime', source: 'runtime' },
    ])
    expect(groups).toEqual([
      { provider: 'filesystem', source: 'project-dsh', skills: [
        { name: 'b', description: 'b', modelInvocable: true, provider: 'filesystem', source: 'project-dsh' },
        { name: 'a', description: 'a', modelInvocable: true, provider: 'filesystem', source: 'project-dsh' },
      ] },
      { provider: 'runtime', source: 'runtime', skills: [
        { name: 'c', description: 'c', modelInvocable: true, provider: 'runtime', source: 'runtime' },
      ] },
    ])
    expect(groups.map(group => group.skills.length)).toEqual([2, 1])
  })
})
