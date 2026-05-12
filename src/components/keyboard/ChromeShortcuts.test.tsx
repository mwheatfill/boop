import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ChromeShortcuts } from '@/components/keyboard/ChromeShortcuts'
import { KeyboardProvider } from '@/components/keyboard/KeyboardProvider'
import { RightRailProvider, useRightRail } from '@/components/right-rail/RightRailProvider'
import { RIGHT_RAIL_ROUTE_IDS } from '@/components/right-rail/useRightRailContent'

interface FakeMatch {
  id: string
  params: Record<string, string>
}

let activeMatches: FakeMatch[] = [
  { id: RIGHT_RAIL_ROUTE_IDS.job, params: { customerSlug: 'acme', jobSlug: 'db-backup' } },
]

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useMatches: <T,>({ select }: { select: (matches: FakeMatch[]) => T }) => select(activeMatches),
}))

vi.mock('@/lib/jobs/server-fns', () => ({
  getJobFn: vi.fn(async () => null),
  listAllJobsFn: vi.fn(async () => []),
}))
vi.mock('@/lib/customers/server-fns', () => ({
  getCustomerFn: vi.fn(async () => null),
  listCustomersFn: vi.fn(async () => []),
}))
vi.mock('@/lib/targets/server-fns', () => ({
  getTargetFn: vi.fn(async () => null),
  listTargetsForCustomerFn: vi.fn(async () => []),
}))
vi.mock('@/lib/runs/server-fns', () => ({
  getRunFn: vi.fn(async () => null),
}))

function Probe() {
  const { open } = useRightRail()
  return <output data-testid="rail-open">{String(open)}</output>
}

function harness() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <KeyboardProvider>
        <RightRailProvider>
          <ChromeShortcuts />
          <Probe />
        </RightRailProvider>
      </KeyboardProvider>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  localStorage.clear()
  activeMatches = [
    { id: RIGHT_RAIL_ROUTE_IDS.job, params: { customerSlug: 'acme', jobSlug: 'db-backup' } },
  ]
})

describe('] toggles the right rail', () => {
  it('flips the open state on keypress', () => {
    harness()
    const initial = screen.getByTestId('rail-open').textContent
    fireEvent.keyDown(window, { key: ']' })
    expect(screen.getByTestId('rail-open').textContent).not.toBe(initial)
  })

  it('does nothing on list routes where no rail is available', () => {
    activeMatches = [{ id: '/_authenticated/', params: {} }]
    harness()
    expect(screen.getByTestId('rail-open').textContent).toBe('false')
    fireEvent.keyDown(window, { key: ']' })
    expect(screen.getByTestId('rail-open').textContent).toBe('false')
  })

  it('input-skip guard: ] inside an <input> does not toggle', () => {
    harness()
    const input = document.createElement('input')
    document.body.appendChild(input)
    input.focus()
    const initial = screen.getByTestId('rail-open').textContent
    fireEvent.keyDown(input, { key: ']' })
    expect(screen.getByTestId('rail-open').textContent).toBe(initial)
    document.body.removeChild(input)
  })
})
