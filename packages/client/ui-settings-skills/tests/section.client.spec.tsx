// @vitest-environment jsdom
/**
 * What the Skills section shows: the empty line when no tab was contributed,
 * the tab chrome with mount-on-select panels, and the keyboard navigation.
 */

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { SkillsSettingsSection, type SkillsSettingsSectionProps, type SkillsSettingsTabEntry } from '../src/client/SkillsSettingsSection.tsx'
import { en } from '../src/client/locales.ts'

afterEach(cleanup)

const t = (key: keyof typeof en) => en[key]

function renderSection(rows: readonly SkillsSettingsTabEntry[]) {
  const props = {
    t,
    useTabs: (selector: (value: readonly SkillsSettingsTabEntry[]) => unknown) => selector(rows),
    renderSlot: (_name: string, _owner: unknown, options: { only?: string }) => (
      <span>{options.only}</span>
    ),
  } as unknown as SkillsSettingsSectionProps
  render(<SkillsSettingsSection {...props} />)
}

describe('SkillsSettingsSection', () => {
  it('leads with its heading and intro', () => {
    renderSection([{ id: 'list', order: 0, label: en.listTab }])
    expect(screen.getByRole('heading', { name: en.title })).toBeTruthy()
    expect(screen.getByText(en.intro)).toBeTruthy()
  })

  it('says so when no tab was contributed', () => {
    renderSection([])
    expect(screen.getByText(en.empty)).toBeTruthy()
    expect(screen.queryByRole('tab')).toBeNull()
  })

  it('defaults to the first ordered tab and mounts another only after selection', () => {
    renderSection([
      { id: 'list', order: 0, label: en.listTab },
      { id: 'config', order: 10, label: en.configTab },
    ])

    const list = screen.getByRole('tab', { name: en.listTab })
    const config = screen.getByRole('tab', { name: en.configTab })
    expect(list.getAttribute('aria-selected')).toBe('true')
    expect(screen.getByText('list')).toBeTruthy()
    expect(screen.queryByText('config')).toBeNull()

    fireEvent.click(config)
    expect(config.getAttribute('aria-selected')).toBe('true')
    expect(screen.getByText('config')).toBeTruthy()
    expect(screen.getByText('list').closest('[role="tabpanel"]')).toHaveProperty('hidden', true)

    fireEvent.click(list)
    expect(list.getAttribute('aria-selected')).toBe('true')
    expect(screen.getByText('config').closest('[role="tabpanel"]')).toHaveProperty('hidden', true)
  })

  it('navigates tabs with arrow keys and focus moves with the selection', () => {
    renderSection([
      { id: 'list', order: 0, label: en.listTab },
      { id: 'config', order: 10, label: en.configTab },
    ])
    const list = screen.getByRole('tab', { name: en.listTab })
    const config = screen.getByRole('tab', { name: en.configTab })

    fireEvent.keyDown(list, { key: 'ArrowRight' })
    expect(config.getAttribute('aria-selected')).toBe('true')
    expect(document.activeElement).toBe(config)

    fireEvent.keyDown(config, { key: 'ArrowRight' })
    expect(list.getAttribute('aria-selected')).toBe('true')
    expect(document.activeElement).toBe(list)

    fireEvent.keyDown(list, { key: 'ArrowLeft' })
    expect(config.getAttribute('aria-selected')).toBe('true')
    expect(document.activeElement).toBe(config)

    fireEvent.keyDown(config, { key: 'Home' })
    expect(list.getAttribute('aria-selected')).toBe('true')
    expect(document.activeElement).toBe(list)

    fireEvent.keyDown(list, { key: 'End' })
    expect(config.getAttribute('aria-selected')).toBe('true')
    expect(document.activeElement).toBe(config)

    // Non-navigation keys leave the selection untouched.
    fireEvent.keyDown(config, { key: 'Enter' })
    expect(config.getAttribute('aria-selected')).toBe('true')
  })
})
