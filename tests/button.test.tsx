// Coverage for the canonical shadcn Button primitive. Asserts the
// data-slot/data-variant/data-size attributes (load-bearing for canonical
// CSS selectors), ref forwarding through the React 19 ref-as-prop
// pattern, and Slot.Root behavior under asChild.
import { render, screen } from '@testing-library/react'
import { createRef } from 'react'
import { describe, expect, it } from 'vitest'
import { Button } from '@/components/ui/button'

describe('Button', () => {
  it('renders a button with the label as accessible name and default data attrs', () => {
    render(<Button>Save</Button>)
    const btn = screen.getByRole('button', { name: 'Save' })
    expect(btn.dataset.slot).toBe('button')
    expect(btn.dataset.variant).toBe('default')
    expect(btn.dataset.size).toBe('default')
  })

  it('applies variant + size classes and data attrs', () => {
    render(
      <Button variant="destructive" size="lg">
        Delete
      </Button>,
    )
    const btn = screen.getByRole('button', { name: 'Delete' })
    expect(btn.dataset.variant).toBe('destructive')
    expect(btn.dataset.size).toBe('lg')
    expect(btn.className).toContain('bg-destructive')
    expect(btn.className).toContain('h-10')
  })

  it('forwards ref to the underlying button (React 19 ref-as-prop)', () => {
    const ref = createRef<HTMLButtonElement>()
    render(<Button ref={ref}>Hi</Button>)
    expect(ref.current).toBeInstanceOf(HTMLButtonElement)
  })

  it('renders as the provided child element when asChild is set', () => {
    render(
      <Button asChild>
        <a href="/docs">Docs</a>
      </Button>,
    )
    // Slot.Root means the child <a> wins; no <button> in the tree.
    expect(screen.queryByRole('button')).toBeNull()
    const link = screen.getByRole('link', { name: 'Docs' })
    expect(link.getAttribute('href')).toBe('/docs')
    // Variant classes are still applied to the slotted child.
    expect(link.className).toContain('bg-primary')
    // data-slot also propagates to the slotted child.
    expect(link.dataset.slot).toBe('button')
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
})
