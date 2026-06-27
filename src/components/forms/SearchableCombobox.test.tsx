import { fireEvent, render, screen, within } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { SearchableCombobox } from './SearchableCombobox'

interface Workspace {
  slug: string
  name: string
}

const acme: Workspace = { slug: 'acme', name: 'Acme' }
const beta: Workspace = { slug: 'beta', name: 'Beta' }
const switchthink: Workspace = { slug: 'switchthink', name: 'SwitchThink' }
const workspaces: Workspace[] = [acme, beta, switchthink]
const EMPTY_WORKSPACES: Workspace[] = []

function Harness({
  initialValue = null,
  recents = EMPTY_WORKSPACES,
  createAffordance,
}: {
  initialValue?: Workspace | null
  recents?: Workspace[]
  createAffordance?: Parameters<typeof SearchableCombobox<Workspace>>[0]['createAffordance']
}) {
  const [value, setValue] = useState<Workspace | null>(null)
  const selected = value ?? initialValue
  return (
    <SearchableCombobox<Workspace>
      label="Workspace"
      items={workspaces}
      recents={recents}
      value={selected}
      onValueChange={setValue}
      getId={(c) => c.slug}
      getLabel={(c) => c.name}
      searchKeywords={(c) => [c.slug]}
      {...(createAffordance ? { createAffordance } : {})}
    />
  )
}

function openPopup() {
  const trigger = screen.getByRole('combobox')
  fireEvent.click(trigger)
  return trigger
}

describe('SearchableCombobox', () => {
  it('opens, renders all items, and selects on click', () => {
    render(<Harness />)
    openPopup()
    const list = screen.getByRole('listbox')
    expect(within(list).getByText('Acme')).toBeTruthy()
    expect(within(list).getByText('Beta')).toBeTruthy()
    fireEvent.click(within(list).getByText('Beta'))
    expect(screen.getByRole('combobox').textContent).toContain('Beta')
  })

  it('filters via fuzzy on input', () => {
    render(<Harness />)
    openPopup()
    const input = screen.getByPlaceholderText(/Search workspace/i)
    fireEvent.change(input, { target: { value: 'swit' } })
    const list = screen.getByRole('listbox')
    expect(within(list).queryByText('Acme')).toBeNull()
    expect(within(list).getByText('SwitchThink')).toBeTruthy()
  })

  it('renders a Recent section above All when recents are present', () => {
    render(<Harness recents={[beta]} />)
    openPopup()
    const list = screen.getByRole('listbox')
    expect(within(list).getByText(/recent/i)).toBeTruthy()
    expect(within(list).getByText(/all/i)).toBeTruthy()
  })

  it('shows the create row when query has no matches and affordance is enabled', () => {
    const onCreate = vi.fn()
    render(<Harness createAffordance={{ enabled: true, onCreate }} />)
    openPopup()
    const input = screen.getByPlaceholderText(/Search workspace/i)
    fireEvent.change(input, { target: { value: 'zenith' } })
    const createBtn = screen.getByRole('button', { name: /Create "zenith"/ })
    fireEvent.click(createBtn)
    expect(onCreate).toHaveBeenCalledWith('zenith')
  })

  it('renders a disabled create row with the reason when the affordance is disabled', () => {
    render(
      <Harness
        createAffordance={{
          enabled: false,
          disabledReason: 'Admin only',
          onCreate: () => {},
        }}
      />,
    )
    openPopup()
    const input = screen.getByPlaceholderText(/Search workspace/i)
    fireEvent.change(input, { target: { value: 'zenith' } })
    const row = screen.getByText(/Create "zenith"/i)
    expect(row).toBeTruthy()
    expect(screen.getByText(/Admin only/i)).toBeTruthy()
  })

  it('suppresses the create row when the query exactly matches an existing item', () => {
    render(<Harness createAffordance={{ enabled: true, onCreate: vi.fn() }} />)
    openPopup()
    const input = screen.getByPlaceholderText(/Search workspace/i)
    fireEvent.change(input, { target: { value: 'Acme' } })
    expect(screen.queryByRole('button', { name: /Create "Acme"/ })).toBeNull()
  })
})
