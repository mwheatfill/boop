import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { TargetHealth } from '@/shared/schemas/target'
import { TargetHealthBadge } from './TargetHealthBadge'

const cases: Array<[TargetHealth, string]> = [
  ['operational', 'Healthy'],
  ['origin_unreachable', 'Unreachable'],
  ['tunnel_offline', 'Tunnel offline'],
  ['auth_error', 'Auth failed'],
  ['checking', 'Checking…'],
]

describe('TargetHealthBadge', () => {
  it('renders a label for every health', () => {
    for (const [health, label] of cases) {
      const { unmount } = render(<TargetHealthBadge health={health} />)
      expect(screen.getByText(label)).toBeTruthy()
      unmount()
    }
  })
})
