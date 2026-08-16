// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { PersonalizationSection } from '../src/client/PersonalizationSection.tsx'
import type { PersonalizationSectionProps } from '../src/client/PersonalizationSection.tsx'
import { en } from '../src/client/locales.ts'

afterEach(cleanup)

// The seat's key domain is settings ∪ common; the stub answers from the
// package dictionary and falls back to the key like the real chain.
const t = ((key: string, params?: Record<string, string>): string => {
  const template = (en as Record<string, string>)[key] ?? key
  return params === undefined
    ? template
    : template.replace(/\{(\w+)\}/g, (_: string, name: string) => String(params[name] ?? ''))
}) as PersonalizationSectionProps['t']

function mount(load: () => Promise<string[]>, save: (items: string[]) => Promise<void>) {
  return render(<PersonalizationSection t={t} load={load} save={save} />)
}

describe('PersonalizationSection', () => {
  it('renders the loaded instructions as one line each', async () => {
    mount(async () => ['first rule', 'second rule'], async () => {})
    const editor = (await screen.findByRole('textbox')) as HTMLTextAreaElement
    await waitFor(() => { expect(editor.value).toBe('first rule\nsecond rule') })
  })

  it('shows the placeholder when no instructions are stored', async () => {
    mount(async () => [], async () => {})
    const editor = (await screen.findByPlaceholderText('Add custom instructions...')) as HTMLTextAreaElement
    expect(editor.value).toBe('')
  })

  it('saves the edited text, splitting lines and dropping blanks', async () => {
    const save = vi.fn(async () => {})
    mount(async () => ['keep'], save)
    const editor = (await screen.findByRole('textbox')) as HTMLTextAreaElement
    await waitFor(() => { expect(editor.value).toBe('keep') })
    fireEvent.change(editor, { target: { value: 'keep\n\n  new rule  ' } })
    fireEvent.click(screen.getByText('Save'))
    await waitFor(() => { expect(save).toHaveBeenCalledWith(['keep', 'new rule']) })
    expect(screen.getByText('Saved')).toBeTruthy()
  })

  it('surfaces a save failure', async () => {
    const save = vi.fn(async () => { throw new Error('settings write rejected') })
    mount(async () => ['first'], save)
    const editor = (await screen.findByRole('textbox')) as HTMLTextAreaElement
    await waitFor(() => { expect(editor.value).toBe('first') })
    fireEvent.click(screen.getByText('Save'))
    await waitFor(() => {
      expect(screen.getByText(/Failed to save: settings write rejected/)).toBeTruthy()
    })
  })
})
