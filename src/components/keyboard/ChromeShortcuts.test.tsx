import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ChromeShortcuts } from '@/components/keyboard/ChromeShortcuts'
import { KeyboardProvider } from '@/components/keyboard/KeyboardProvider'
import { RightRailProvider } from '@/components/right-rail/RightRailProvider'

let activePath = '/customers/acme/jobs/db-backup'

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useRouterState: <T,>({ select }: { select: (s: { location: { pathname: string } }) => T }) =>
    select({ location: { pathname: activePath } }),
}))

vi.mock('@/lib/jobs/server-fns', () => ({
  getJobFn: vi.fn(async () => null),
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

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useRightRail } from '@/components/right-rail/RightRailProvider'

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
  activePath = '/customers/acme/jobs/db-backup'
})

describe('] toggles the right rail', () => {
  it('flips the open state on keypress', () => {
    harness()
    const initial = screen.getByTestId('rail-open').textContent
    fireEvent.keyDown(window, { key: ']' })
    expect(screen.getByTestId('rail-open').textContent).not.toBe(initial)
  })

  it('does nothing on list routes where no rail is available', () => {
    activePath = '/'
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
