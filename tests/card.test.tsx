// Coverage for the Card primitive family. Verifies the semantic HTML choices
// (h3 for CardTitle, p for CardDescription) hold across the React 19
// ref-as-prop migration.
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

describe('Card', () => {
  it('composes a card with semantic title + description', () => {
    render(
      <Card data-testid="card">
        <CardHeader>
          <CardTitle>Hello</CardTitle>
          <CardDescription>World</CardDescription>
        </CardHeader>
        <CardContent>Body</CardContent>
      </Card>,
    )

    const card = screen.getByTestId('card')
    expect(card.className).toContain('rounded-lg')

    const heading = screen.getByRole('heading', { name: 'Hello', level: 3 })
    expect(heading.tagName).toBe('H3')

    expect(screen.getByText('World').tagName).toBe('P')
    expect(screen.getByText('Body')).toBeDefined()
  })

  it('forwards className alongside built-in styles', () => {
    render(
      <Card className="custom-extra" data-testid="card">
        contents
      </Card>,
    )
    const card = screen.getByTestId('card')
    expect(card.className).toContain('custom-extra')
    expect(card.className).toContain('bg-card')
  })
})
