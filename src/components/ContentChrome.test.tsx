import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ContentChrome } from '@/components/ContentChrome'
import { DensityProvider } from '@/components/density/DensityProvider'
import { RightRailProvider } from '@/components/right-rail/RightRailProvider'
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
  countCustomersFn: vi.fn(async () => 0),
}))
vi.mock('@/lib/targets/server-fns', () => ({
  getTargetFn: vi.fn(async () => null),
  listTargetsForCustomerFn: vi.fn(async () => []),
}))
vi.mock('@/lib/runs/server-fns', () => ({
  getRunFn: vi.fn(async () => null),
}))

function renderCluster() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <DensityProvider>
        <RightRailProvider>
          <ContentChrome filter={<button type="button">Filter</button>} />
        </RightRailProvider>
      </DensityProvider>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  localStorage.clear()
  activeMatches = [
    { id: RIGHT_RAIL_ROUTE_IDS.job, params: { customerSlug: 'acme', jobSlug: 'db-backup' } },
  ]
})

describe('<ContentChrome>', () => {
  it('renders all three slots: filter, display options, right-rail toggle', () => {
    renderCluster()
    expect(screen.getByRole('button', { name: 'Filter' })).toBeTruthy()
    expect(screen.getByRole('button', { name: /display options/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /properties panel/i })).toBeTruthy()
  })

  it('disables the right-rail toggle on routes without entity context', () => {
    activeMatches = [{ id: '/_authenticated/', params: {} }]
    renderCluster()
    const toggle = screen.getByRole('button', { name: /properties panel/i }) as HTMLButtonElement
    expect(toggle.disabled).toBe(true)
  })

  it('the right-rail toggle reflects the open state via aria-pressed', () => {
    renderCluster()
    const toggle = screen.getByRole('button', { name: /properties panel/i })
    expect(['true', 'false']).toContain(toggle.getAttribute('aria-pressed'))
  })
})
