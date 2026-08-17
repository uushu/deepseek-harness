// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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

/** The skill card for one name (or 'new'). */
function cardOf(view: ReturnType<typeof render>, name: string): HTMLElement {
  const card = view.container.querySelector<HTMLElement>(`[data-skill="${name}"]`)
  if (card === null) throw new Error(`missing skill card ${name}`)
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
  it('lists only project-owned skills with editable forms plus the new-skill form', async () => {
    const view = render(<SkillsConfigTab {...configProps({})} />)
    expect(await screen.findByText('demo')).toBeTruthy()

    // Non-project skills are not config items: exposed read-only on the list tab.
    expect(screen.queryByText('user-only')).toBeNull()
    expect(screen.queryByText('bundled')).toBeNull()
    // No add button; the new-skill form is always visible and open.
    expect(screen.queryByRole('button', { name: en.addSkill })).toBeNull()
    expect(view.container.querySelector('[data-skill="new"]')?.getAttribute('data-open')).toBe('true')

    const demo = cardOf(view, 'demo')
    expect(demo.getAttribute('data-open')).toBe('false')
    fireEvent.click(within(demo).getByRole('button', { name: `demo, ${en.modelInvocableTag}` }))
    expect(demo.getAttribute('data-open')).toBe('true')
    expect((within(demo).getByLabelText<HTMLInputElement>(en.nameLabel)).value).toBe('demo')
    expect((within(demo).getByLabelText<HTMLInputElement>(en.descriptionLabel)).value).toBe('Demo skill')
    expect((within(demo).getByLabelText<HTMLInputElement>(en.whenToUse)).value).toBe('when demoing')
    expect((within(demo).getByLabelText<HTMLInputElement>(en.modelInvocableTag)).checked).toBe(true)
    // The body loads asynchronously after expand.
    expect(await screen.findByDisplayValue('body content')).toBeTruthy()
    // Clicking the open card again collapses it.
    fireEvent.click(within(demo).getByRole('button', { name: `demo, ${en.modelInvocableTag}` }))
    expect(demo.getAttribute('data-open')).toBe('false')
  })

  it('badges a user-only project skill and keeps its blank guidance', async () => {
    const view = render(<SkillsConfigTab {...configProps({
      list: async () => ({
        sessionless: false,
        skills: [
          { name: 'demo-user', description: 'User demo', modelInvocable: false, provider: 'filesystem', source: 'project-dsh' },
        ],
      }),
    })} />)
    await screen.findByText('demo-user')
    const card = cardOf(view, 'demo-user')
    fireEvent.click(within(card).getByRole('button', { name: `demo-user, ${en.userOnlyTag}` }))
    expect((within(card).getByLabelText<HTMLInputElement>(en.whenToUse)).value).toBe('')
    expect((within(card).getByLabelText<HTMLInputElement>(en.modelInvocableTag)).checked).toBe(false)
  })

  it('shows the empty state when no project skills exist but the new form stays', async () => {
    const view = render(<SkillsConfigTab {...configProps({
      list: async () => ({ sessionless: false, skills: [RESULT.skills[1]!, RESULT.skills[2]!] }),
    })} />)
    expect(await screen.findByText(en.empty)).toBeTruthy()
    expect(view.container.querySelector('[data-skill="new"]')).toBeTruthy()
  })

  it('handles a body read failure without crashing', async () => {
    const read = vi.fn<SkillsConfigTabInjected['read']>().mockRejectedValue(new Error('read exploded'))
    const view = render(<SkillsConfigTab {...configProps({ read })} />)
    await screen.findByText('demo')

    const demo = cardOf(view, 'demo')
    fireEvent.click(within(demo).getByRole('button', { name: `demo, ${en.modelInvocableTag}` }))
    await waitFor(() => { expect(read).toHaveBeenCalledWith('demo') })
    // The failure path clears the loading flag and the form stays usable.
    expect((within(demo).getByLabelText<HTMLInputElement>(en.nameLabel)).value).toBe('demo')
  })

  it('saves an edited existing skill through write', async () => {
    const write = vi.fn<SkillsConfigTabInjected['write']>().mockResolvedValue({ name: 'demo' })
    const view = render(<SkillsConfigTab {...configProps({ write })} />)
    await screen.findByText('demo')

    const demo = cardOf(view, 'demo')
    fireEvent.click(within(demo).getByRole('button', { name: `demo, ${en.modelInvocableTag}` }))
    fireEvent.change(within(demo).getByLabelText<HTMLInputElement>(en.descriptionLabel), { target: { value: 'Updated' } })
    fireEvent.click(within(demo).getByRole('button', { name: en.save }))

    await waitFor(() => {
      expect(write).toHaveBeenCalledWith(expect.objectContaining({ name: 'demo', description: 'Updated' }))
    })
  })

  it('deletes an existing skill through remove', async () => {
    const remove = vi.fn<SkillsConfigTabInjected['remove']>().mockResolvedValue({ removed: true })
    const view = render(<SkillsConfigTab {...configProps({ remove })} />)
    await screen.findByText('demo')

    const demo = cardOf(view, 'demo')
    fireEvent.click(within(demo).getByRole('button', { name: `demo, ${en.modelInvocableTag}` }))
    fireEvent.click(within(demo).getByRole('button', { name: en.deleteSkill }))

    await waitFor(() => { expect(remove).toHaveBeenCalledWith('demo') })
  })

  it('saves a new skill without a when-to-use line', async () => {
    const write = vi.fn<SkillsConfigTabInjected['write']>().mockResolvedValue({ name: 'fresh' })
    const view = render(<SkillsConfigTab {...configProps({ write })} />)
    await screen.findByText('demo')

    const fresh = cardOf(view, 'new')
    fireEvent.change(within(fresh).getByLabelText<HTMLInputElement>(en.nameLabel), { target: { value: 'fresh' } })
    fireEvent.change(within(fresh).getByLabelText<HTMLInputElement>(en.descriptionLabel), { target: { value: 'A fresh skill' } })
    fireEvent.change(within(fresh).getByLabelText<HTMLInputElement>(en.contentLabel), { target: { value: 'Fresh body' } })
    fireEvent.click(within(fresh).getByRole('button', { name: en.save }))

    await waitFor(() => {
      expect(write).toHaveBeenCalledWith({
        name: 'fresh',
        description: 'A fresh skill',
        modelInvocable: true,
        content: 'Fresh body',
      })
    })
  })

  it('saves a new skill with when-to-use and model toggle', async () => {
    const write = vi.fn<SkillsConfigTabInjected['write']>().mockResolvedValue({ name: 'fresh' })
    const view = render(<SkillsConfigTab {...configProps({ write })} />)
    await screen.findByText('demo')

    const fresh = cardOf(view, 'new')
    fireEvent.change(within(fresh).getByLabelText(en.nameLabel), { target: { value: 'fresh' } })
    fireEvent.change(within(fresh).getByLabelText(en.descriptionLabel), { target: { value: 'A fresh skill' } })
    fireEvent.change(within(fresh).getByLabelText(en.whenToUse), { target: { value: 'when fresh' } })
    fireEvent.click(within(fresh).getByLabelText(en.modelInvocableTag))
    fireEvent.change(within(fresh).getByLabelText(en.contentLabel), { target: { value: 'Fresh body' } })
    fireEvent.click(within(fresh).getByRole('button', { name: en.save }))

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
    const view = render(<SkillsConfigTab {...configProps({ write })} />)
    await screen.findByText('demo')

    const fresh = cardOf(view, 'new')
    fireEvent.change(within(fresh).getByLabelText(en.nameLabel), { target: { value: 'only-name' } })
    fireEvent.click(within(fresh).getByRole('button', { name: en.save }))

    expect((await screen.findByRole('alert')).textContent).toBe(en.invalidSkill)
    expect(write).not.toHaveBeenCalled()
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
    // Same provider, different source: the source tie-break orders the groups.
    const tied = groupSkills([
      { name: 'x', description: 'x', modelInvocable: true, provider: 'filesystem', source: 'bundled' },
      { name: 'y', description: 'y', modelInvocable: true, provider: 'filesystem', source: 'project-dsh' },
    ])
    expect(tied.map(group => group.source)).toEqual(['bundled', 'project-dsh'])
  })
})
