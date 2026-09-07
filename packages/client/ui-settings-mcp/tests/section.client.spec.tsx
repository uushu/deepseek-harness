// @vitest-environment jsdom
/**
 * What the MCP section shows: the empty line when no tab was contributed, the
 * tab chrome with mount-on-select panels, and the keyboard navigation.
 */

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { McpSettingsSection, type McpSettingsSectionProps, type McpSettingsTabEntry } from '../src/client/McpSettingsSection.tsx'
import { en } from '../src/client/locales.ts'

afterEach(cleanup)

const t = (key: keyof typeof en) => en[key]

function renderSection(rows: readonly McpSettingsTabEntry[]) {
  const props = {
    t,
    useTabs: (selector: (value: readonly McpSettingsTabEntry[]) => unknown) => selector(rows),
    renderSlot: (_name: string, _owner: unknown, options: { only?: string }) => (
      <span>{options.only}</span>
    ),
  } as unknown as McpSettingsSectionProps
  render(<McpSettingsSection {...props} />)
}

describe('McpSettingsSection', () => {
  it('leads with its heading and intro', () => {
    renderSection([{ id: 'config', order: 0, label: en.configTab }])
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
      { id: 'config', order: 0, label: en.configTab },
      { id: 'inventory', order: 10, label: en.inventoryTab },
    ])

    const config = screen.getByRole('tab', { name: en.configTab })
    const inventory = screen.getByRole('tab', { name: en.inventoryTab })
    expect(config.getAttribute('aria-selected')).toBe('true')
    expect(screen.getByText('config')).toBeTruthy()
    expect(screen.queryByText('inventory')).toBeNull()

    fireEvent.click(inventory)
    expect(inventory.getAttribute('aria-selected')).toBe('true')
    expect(screen.getByText('inventory')).toBeTruthy()
    expect(screen.getByText('config').closest('[role="tabpanel"]')).toHaveProperty('hidden', true)

    fireEvent.click(config)
    expect(config.getAttribute('aria-selected')).toBe('true')
    expect(screen.getByText('inventory').closest('[role="tabpanel"]')).toHaveProperty('hidden', true)
  })

  it('navigates tabs with arrow keys and focus moves with the selection', () => {
    renderSection([
      { id: 'config', order: 0, label: en.configTab },
      { id: 'inventory', order: 10, label: en.inventoryTab },
    ])
    const config = screen.getByRole('tab', { name: en.configTab })
    const inventory = screen.getByRole('tab', { name: en.inventoryTab })

    fireEvent.keyDown(config, { key: 'ArrowRight' })
    expect(inventory.getAttribute('aria-selected')).toBe('true')
    expect(document.activeElement).toBe(inventory)

    fireEvent.keyDown(inventory, { key: 'ArrowRight' })
    expect(config.getAttribute('aria-selected')).toBe('true')
    expect(document.activeElement).toBe(config)

    fireEvent.keyDown(config, { key: 'ArrowLeft' })
    expect(inventory.getAttribute('aria-selected')).toBe('true')
    expect(document.activeElement).toBe(inventory)

    fireEvent.keyDown(inventory, { key: 'Home' })
    expect(config.getAttribute('aria-selected')).toBe('true')
    expect(document.activeElement).toBe(config)

    fireEvent.keyDown(config, { key: 'End' })
    expect(inventory.getAttribute('aria-selected')).toBe('true')
    expect(document.activeElement).toBe(inventory)

    // Non-navigation keys leave the selection untouched.
    fireEvent.keyDown(inventory, { key: 'Enter' })
    expect(inventory.getAttribute('aria-selected')).toBe('true')
  })
})
