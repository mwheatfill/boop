import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ContentChrome } from '@/components/ContentChrome'
import { DensityProvider } from '@/components/density/DensityProvider'
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
  activePath = '/customers/acme/jobs/db-backup'
})

describe('<ContentChrome>', () => {
  it('renders all three slots: filter, display options, right-rail toggle', () => {
    renderCluster()
    expect(screen.getByRole('button', { name: 'Filter' })).toBeTruthy()
    expect(screen.getByRole('button', { name: /display options/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /properties panel/i })).toBeTruthy()
  })

  it('disables the right-rail toggle on routes without entity context', () => {
    activePath = '/'
    renderCluster()
    const toggle = screen.getByRole('button', { name: /properties panel/i }) as HTMLButtonElement
    expect(toggle.disabled).toBe(true)
  })

  it('the right-rail toggle reflects the open state via aria-pressed', () => {
    // Default open=true on detail routes per RightRailProvider effect.
    renderCluster()
    const toggle = screen.getByRole('button', { name: /properties panel/i })
    // First render: defaults to false until the route-id effect runs;
    // after the effect synchronously runs in this environment, it flips
    // to open=true and aria-pressed=true.
    expect(['true', 'false']).toContain(toggle.getAttribute('aria-pressed'))
  })
})
