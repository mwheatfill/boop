import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

describe('Card', () => {
  it('composes a card with title, description, action, and content', () => {
    render(
      <Card data-testid="card">
        <CardHeader>
          <CardTitle>Hello</CardTitle>
          <CardDescription>World</CardDescription>
          <CardAction>Act</CardAction>
        </CardHeader>
        <CardContent>Body</CardContent>
      </Card>,
    )

    const card = screen.getByTestId('card')
    expect(card.dataset.slot).toBe('card')
    expect(card.dataset.size).toBe('default')
    expect(card.className).toContain('rounded-xl')
    expect(card.className).toContain('flex')
    expect(card.className).toContain('flex-col')

    const title = screen.getByText('Hello')
    expect(title.tagName).toBe('DIV')
    expect(title.dataset.slot).toBe('card-title')

    const description = screen.getByText('World')
    expect(description.tagName).toBe('DIV')
    expect(description.dataset.slot).toBe('card-description')

    const action = screen.getByText('Act')
    expect(action.dataset.slot).toBe('card-action')

    expect(screen.getByText('Body').dataset.slot).toBe('card-content')
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

  it('honors the size prop via data-size', () => {
    render(
      <Card size="sm" data-testid="card">
        small
      </Card>,
    )
    expect(screen.getByTestId('card').dataset.size).toBe('sm')
  })
})
