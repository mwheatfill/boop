import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { RIGHT_RAIL_ROUTE_IDS, useRightRailContent } from './useRightRailContent'

interface FakeMatch {
  id: string
  params: Record<string, string>
}

let activeMatches: FakeMatch[] = []

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
  const content = useRightRailContent()
  return <output data-testid="route-id">{content?.routeId ?? 'none'}</output>
}

function renderProbe() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <Probe />
    </QueryClientProvider>,
  )
}

describe('useRightRailContent', () => {
  it('returns null on list / non-entity routes', () => {
    for (const id of [
      '/_authenticated/',
      '/_authenticated/jobs',
      '/_authenticated/customers/',
      '/_authenticated/runs',
      '/_authenticated/me',
      '/login',
    ]) {
      activeMatches = [{ id, params: {} }]
      const { unmount } = renderProbe()
      expect(screen.getByTestId('route-id').textContent).toBe('none')
      unmount()
    }
  })

  it('returns the customer route id on /customers/:slug', () => {
    activeMatches = [{ id: RIGHT_RAIL_ROUTE_IDS.customer, params: { customerSlug: 'acme' } }]
    renderProbe()
    expect(screen.getByTestId('route-id').textContent).toBe(RIGHT_RAIL_ROUTE_IDS.customer)
  })

  it('returns the job route id on the job detail route', () => {
    activeMatches = [
      { id: RIGHT_RAIL_ROUTE_IDS.job, params: { customerSlug: 'acme', jobSlug: 'db-backup' } },
    ]
    renderProbe()
    expect(screen.getByTestId('route-id').textContent).toBe(RIGHT_RAIL_ROUTE_IDS.job)
  })

  it('returns the run route id on the run detail route', () => {
    activeMatches = [
      {
        id: RIGHT_RAIL_ROUTE_IDS.run,
        params: { customerSlug: 'acme', jobSlug: 'db-backup', runId: 'run-123' },
      },
    ]
    renderProbe()
    expect(screen.getByTestId('route-id').textContent).toBe(RIGHT_RAIL_ROUTE_IDS.run)
  })

  it('returns the target route id on /customers/:slug/targets/:slug', () => {
    activeMatches = [
      {
        id: RIGHT_RAIL_ROUTE_IDS.target,
        params: { customerSlug: 'acme', targetSlug: 'primary-api' },
      },
    ]
    renderProbe()
    expect(screen.getByTestId('route-id').textContent).toBe(RIGHT_RAIL_ROUTE_IDS.target)
  })

  it('does not match /customers/new', () => {
    activeMatches = [{ id: '/_authenticated/_admin/customers/new', params: {} }]
    renderProbe()
    expect(screen.getByTestId('route-id').textContent).toBe('none')
  })
})
