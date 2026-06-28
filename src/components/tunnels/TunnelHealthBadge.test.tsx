import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { TunnelHealth } from '@/lib/tunnels/health'
import { TunnelHealthBadge } from './TunnelHealthBadge'

const cases: Array<[TunnelHealth, string]> = [
  ['operational', 'Operational'],
  ['degraded', 'Degraded'],
  ['down', 'Down'],
  ['not_connected', 'Not connected'],
  ['unverified', 'Unverified'],
]

describe('TunnelHealthBadge', () => {
  it('renders a label for every health state', () => {
    for (const [health, label] of cases) {
      const { unmount } = render(<TunnelHealthBadge health={health} />)
      expect(screen.getByText(label)).toBeTruthy()
      unmount()
    }
  })
})
