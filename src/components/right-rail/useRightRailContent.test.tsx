import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useRightRailContent } from './useRightRailContent'

let activePath = '/'

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
    for (const path of ['/', '/jobs', '/customers', '/runs', '/me', '/login']) {
      activePath = path
      const { unmount } = renderProbe()
      expect(screen.getByTestId('route-id').textContent).toBe('none')
      unmount()
    }
  })

  it('returns customer-detail on /customers/:slug', () => {
    activePath = '/customers/acme'
    renderProbe()
    expect(screen.getByTestId('route-id').textContent).toBe('customer-detail')
  })

  it('returns job-detail on /customers/:slug/jobs/:slug', () => {
    activePath = '/customers/acme/jobs/db-backup'
    renderProbe()
    expect(screen.getByTestId('route-id').textContent).toBe('job-detail')
  })

  it('returns run-detail on the run route', () => {
    activePath = '/customers/acme/jobs/db-backup/runs/run-123'
    renderProbe()
    expect(screen.getByTestId('route-id').textContent).toBe('run-detail')
  })

  it('returns target-detail on /customers/:slug/targets/:slug', () => {
    activePath = '/customers/acme/targets/primary-api'
    renderProbe()
    expect(screen.getByTestId('route-id').textContent).toBe('target-detail')
  })

  it('does not match /customers/new', () => {
    activePath = '/customers/new'
    renderProbe()
    expect(screen.getByTestId('route-id').textContent).toBe('none')
  })
})
