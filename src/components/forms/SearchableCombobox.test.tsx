import { fireEvent, render, screen, within } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { SearchableCombobox } from './SearchableCombobox'

interface Customer {
  slug: string
  name: string
}

const acme: Customer = { slug: 'acme', name: 'Acme' }
const beta: Customer = { slug: 'beta', name: 'Beta' }
const switchthink: Customer = { slug: 'switchthink', name: 'SwitchThink' }
const customers: Customer[] = [acme, beta, switchthink]
const EMPTY_CUSTOMERS: Customer[] = []

function Harness({
  initialValue = null,
  recents = EMPTY_CUSTOMERS,
  createAffordance,
}: {
  initialValue?: Customer | null
  recents?: Customer[]
  createAffordance?: Parameters<typeof SearchableCombobox<Customer>>[0]['createAffordance']
}) {
  const [value, setValue] = useState<Customer | null>(null)
  const selected = value ?? initialValue
  return (
    <SearchableCombobox<Customer>
      label="Customer"
      items={customers}
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
    const input = screen.getByPlaceholderText(/Search customer/i)
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
    const input = screen.getByPlaceholderText(/Search customer/i)
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
    const input = screen.getByPlaceholderText(/Search customer/i)
    fireEvent.change(input, { target: { value: 'zenith' } })
    const row = screen.getByText(/Create "zenith"/i)
    expect(row).toBeTruthy()
    expect(screen.getByText(/Admin only/i)).toBeTruthy()
  })

  it('suppresses the create row when the query exactly matches an existing item', () => {
    render(<Harness createAffordance={{ enabled: true, onCreate: vi.fn() }} />)
    openPopup()
    const input = screen.getByPlaceholderText(/Search customer/i)
    fireEvent.change(input, { target: { value: 'Acme' } })
    expect(screen.queryByRole('button', { name: /Create "Acme"/ })).toBeNull()
  })
})
