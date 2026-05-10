// Coverage for the canonical shadcn Button (base-vega style: base-ui
// primitives + the "vega" visual theme). Asserts the data-slot attribute
// (load-bearing for canonical selectors), ref forwarding through the
// React 19 ref-as-prop pattern, native HTML pass-through, and variant
// classes.
//
// Note: base-ui's Button primitive doesn't use the Slot pattern that
// Radix's Slot.Root provides, so there's no `asChild` API on the
// canonical base-vega Button. Composition with custom elements happens
// through base-ui's `render` prop where needed.
import { render, screen } from '@testing-library/react'
import { createRef } from 'react'
import { describe, expect, it } from 'vitest'
import { Button } from '@/components/ui/button'

describe('Button', () => {
  it('renders a button with the label as accessible name and default data attrs', () => {
    render(<Button>Save</Button>)
    const btn = screen.getByRole('button', { name: 'Save' })
    expect(btn.dataset.slot).toBe('button')
  })

  it('applies variant + size classes', () => {
    render(
      <Button variant="destructive" size="lg">
        Delete
      </Button>,
    )
    const btn = screen.getByRole('button', { name: 'Delete' })
    expect(btn.className).toContain('bg-destructive')
    expect(btn.className).toContain('h-10')
  })

  it('forwards ref to the underlying button (React 19 ref-as-prop)', () => {
    const ref = createRef<HTMLButtonElement>()
    render(<Button ref={ref}>Hi</Button>)
    expect(ref.current).toBeInstanceOf(HTMLButtonElement)
  })

  it('passes through native button attributes', () => {
    render(
      <Button type="submit" disabled>
        Submit
      </Button>,
    )
    const btn = screen.getByRole('button', { name: 'Submit' }) as HTMLButtonElement
    expect(btn.type).toBe('submit')
    expect(btn.disabled).toBe(true)
  })

  it('exposes the new sm/xs/lg + icon variants', () => {
    render(
      <Button size="xs" data-testid="xs">
        x
      </Button>,
    )
    const btn = screen.getByTestId('xs')
    expect(btn.className).toContain('h-6')
  })
})
