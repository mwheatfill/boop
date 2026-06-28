import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { TunnelState } from '@/lib/tunnels/health'
import { TunnelStateBadge } from './TunnelStateBadge'

const cases: Array<[TunnelState, string]> = [
  ['provisioning', 'Setting up…'],
  ['install_pending', 'Install the connector'],
  ['operational', 'Operational'],
  ['attention', 'Needs attention'],
]

describe('TunnelStateBadge', () => {
  it('renders a label for every state', () => {
    for (const [state, label] of cases) {
      const { unmount } = render(<TunnelStateBadge state={state} />)
      expect(screen.getByText(label)).toBeTruthy()
      unmount()
    }
  })
})
