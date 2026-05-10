// Smoke + behavior coverage for the Button primitive. Existence of any test
// here also guards the React 19 ref-as-prop migration: forwardRef-based code
// that breaks the new pattern would fail on the ref forwarding test.
import { render, screen } from '@testing-library/react'
import { createRef } from 'react'
import { describe, expect, it } from 'vitest'
import { Button } from '@/components/ui/button'

describe('Button', () => {
  it('renders a button by default with the label as accessible name', () => {
    render(<Button>Save</Button>)
    expect(screen.getByRole('button', { name: 'Save' })).toBeDefined()
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

  it('renders as the provided child element when asChild is set', () => {
    render(
      <Button asChild>
        <a href="/docs">Docs</a>
      </Button>,
    )
    // The Slot pattern means the child <a> wins; no <button> in the tree.
    expect(screen.queryByRole('button')).toBeNull()
    const link = screen.getByRole('link', { name: 'Docs' })
    expect(link.getAttribute('href')).toBe('/docs')
    // Variant classes are still applied to the slotted child.
    expect(link.className).toContain('bg-primary')
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
