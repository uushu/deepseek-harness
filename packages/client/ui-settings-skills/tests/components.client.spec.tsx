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

function configProps(list: SkillsConfigTabInjected['list']): SkillsConfigTabProps {
  return { t, list } as SkillsConfigTabProps
}

const RESULT: Result = {
  sessionless: false,
  skills: [
    { name: 'demo', description: 'Demo skill', whenToUse: 'when demoing', modelInvocable: true, provider: 'filesystem', source: 'project-dsh' },
    { name: 'user-only', description: 'User skill', modelInvocable: false, provider: 'filesystem', source: 'user-dsh' },
    { name: 'bundled', description: 'Bundled skill', modelInvocable: true, provider: 'filesystem', source: 'bundled' },
    { name: 'runtime-note', description: 'Runtime skill', modelInvocable: true, provider: 'runtime', source: 'runtime' },
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
    expect(screen.getAllByRole('listitem')).toHaveLength(4)
    expect(screen.getAllByText(en.modelInvocableTag)).toHaveLength(3)
    expect(screen.getByText(en.userOnlyTag)).toBeTruthy()

    const demo = screen.getByRole('button', { name: `demo, ${en.modelInvocableTag}` })
    expect(demo.getAttribute('aria-expanded')).toBe('false')
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
    expect(screen.queryByText('private transport detail')).toBeNull()
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

    const deferredFailure = Promise.withResolvers<Result>()
    const pendingFailure = render(<SkillsListTab {...listProps(() => deferredFailure.promise)} />)
    pendingFailure.unmount()
    await act(async () => { deferredFailure.reject(new Error('late failure')) })
  })
})

describe('SkillsConfigTab', () => {
  it('groups skills by provider and source with counts and badges', async () => {
    const deferred = Promise.withResolvers<Result>()
    const list = vi.fn(() => deferred.promise)
    const view = render(<SkillsConfigTab {...configProps(list)} />)
    expect(screen.getByText(en.loading)).toBeTruthy()

    await act(async () => { deferred.resolve(RESULT) })
    expect(list).toHaveBeenCalledOnce()
    expect(screen.getByRole('heading', { name: en.sources })).toBeTruthy()
    expect(view.container.querySelector('[data-skill-group-count]')?.textContent).toBe('4')
    expect(screen.getAllByRole('listitem')).toHaveLength(4 + 4)
    // Each (provider, source) pair is its own group of one.
    expect(view.container.querySelector('[data-group-count]')?.textContent).toBe('1')
    expect(screen.getAllByText('filesystem')).toHaveLength(3)
    expect(screen.getByText('project-dsh')).toBeTruthy()
    expect(screen.getByText('runtime-note')).toBeTruthy()
    expect(screen.getAllByText(en.modelInvocableTag)).toHaveLength(3)
    expect(screen.getByText(en.userOnlyTag)).toBeTruthy()
  })

  it('shows the sessionless and empty states and fails loudly with retry', async () => {
    const sessionless = render(<SkillsConfigTab {...configProps(async () => ({ sessionless: true, skills: [] }))} />)
    expect(await screen.findByText(en.noSession)).toBeTruthy()
    sessionless.unmount()

    const empty = render(<SkillsConfigTab {...configProps(async () => ({ sessionless: false, skills: [] }))} />)
    expect(await screen.findByText(en.empty)).toBeTruthy()
    empty.unmount()

    const list = vi.fn<SkillsConfigTabInjected['list']>()
      .mockRejectedValueOnce(new Error('private transport detail'))
      .mockResolvedValueOnce({ sessionless: false, skills: [] })
    render(<SkillsConfigTab {...configProps(list)} />)
    expect((await screen.findByRole('alert')).textContent).toBe(en.error)
    fireEvent.click(screen.getByRole('button', { name: en.retry }))
    await waitFor(() => { expect(list).toHaveBeenCalledTimes(2) })
    expect(await screen.findByText(en.empty)).toBeTruthy()
  })

  it('contains a synchronous failure and ignores a result after unmount', async () => {
    const syncFailure = vi.fn(() => { throw new Error('namespace unavailable') }) as SkillsConfigTabInjected['list']
    const failed = render(<SkillsConfigTab {...configProps(syncFailure)} />)
    expect((await screen.findByRole('alert')).textContent).toBe(en.error)
    failed.unmount()

    const deferred = Promise.withResolvers<Result>()
    const pending = render(<SkillsConfigTab {...configProps(() => deferred.promise)} />)
    pending.unmount()
    await act(async () => { deferred.resolve(RESULT) })

    const deferredFailure = Promise.withResolvers<Result>()
    const pendingFailure = render(<SkillsConfigTab {...configProps(() => deferredFailure.promise)} />)
    pendingFailure.unmount()
    await act(async () => { deferredFailure.reject(new Error('late failure')) })
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
