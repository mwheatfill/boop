import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AppSidebar } from '@/components/AppSidebar'
import { SidebarProvider } from '@/components/ui/sidebar'
import { PINNED_STORAGE_KEY } from '@/lib/pinned/store'
import { RECENTS_STORAGE_KEY } from '@/lib/recents/store'
import type { User } from '@/shared/schemas/auth'

let activePath = '/'

// Minimal router mock so the sidebar's <Link> renders and useRouterState reads
// our test-driven pathname. The components under test only consume `to`,
// `params`, `activeProps`, and the active pathname.
vi.mock('@tanstack/react-router', () => {
  type LinkProps = {
    to: string
    params?: Record<string, string>
    activeProps?: Record<string, string>
    activeOptions?: { exact?: boolean }
    children: React.ReactNode
    className?: string
  } & Record<string, unknown>
  const resolve = (to: string, params?: Record<string, string>) => {
    if (!params) return to
    return Object.entries(params).reduce((acc, [k, v]) => acc.replace(`$${k}`, v), to)
  }
  const Link = ({ to, params, activeProps, activeOptions, children, ...rest }: LinkProps) => {
    const href = resolve(to, params)
    const isActive = activeOptions?.exact ? activePath === href : activePath.startsWith(href)
    return (
      <a href={href} {...(isActive ? activeProps : {})} {...rest}>
        {children}
      </a>
    )
  }
  return {
    Link,
    useNavigate: () => () => {},
    useParams: () => ({}),
    useSearch: () => ({}),
    useRouterState: <T,>({ select }: { select: (s: { location: { pathname: string } }) => T }) =>
      select({ location: { pathname: activePath } }),
  }
})

const user: User = {
  id: 'usr_test',
  email: 'tester@example.com',
  name: 'Test Operator',
  role: 'operator',
}

function renderSidebar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <SidebarProvider defaultOpen>
        <AppSidebar user={user} />
      </SidebarProvider>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  localStorage.clear()
  activePath = '/'
})

describe('<AppSidebar>', () => {
  it('renders the primary nav items', () => {
    renderSidebar()
    expect(screen.getByRole('link', { name: /home/i })).toBeTruthy()
    expect(screen.getByRole('link', { name: /jobs/i })).toBeTruthy()
    expect(screen.getByRole('link', { name: /runs/i })).toBeTruthy()
    expect(screen.getByRole('link', { name: /targets/i })).toBeTruthy()
  })

  it('marks the active route via data-active', () => {
    activePath = '/jobs'
    renderSidebar()
    const jobsLink = screen.getByRole('link', { name: /jobs/i })
    // Base UI's useRender applies data-active="" (presence-as-truthy) when
    // the SidebarMenuButton's isActive prop is true. Either an empty
    // string or "true" indicates active state in the rendered DOM.
    expect(jobsLink.hasAttribute('data-active')).toBe(true)
    const runsLink = screen.getByRole('link', { name: /runs/i })
    expect(runsLink.hasAttribute('data-active')).toBe(false)
  })

  it('shows empty Recent + Pinned hints when storage is empty', () => {
    renderSidebar()
    expect(screen.getByText(/visited entities will appear here/i)).toBeTruthy()
    expect(screen.getByText(/pin a job from its detail page/i)).toBeTruthy()
  })

  it('renders recents from the shared store', () => {
    localStorage.setItem(
      RECENTS_STORAGE_KEY,
      JSON.stringify([
        {
          id: 'workspace:acme',
          entity: 'workspace',
          label: 'Acme',
          slug: 'acme',
          visitedAt: Date.now(),
        },
      ]),
    )
    renderSidebar()
    expect(screen.getByText('Acme')).toBeTruthy()
  })

  it('renders pinned entries in the persisted order', () => {
    // togglePin sorts alphabetically on insert; the sidebar trusts the
    // stored order on render rather than re-sorting on every paint.
    localStorage.setItem(
      PINNED_STORAGE_KEY,
      JSON.stringify([
        { id: 'a', kind: 'workspace', label: 'Alpha', slug: 'a' },
        { id: 'b', kind: 'workspace', label: 'Bravo', slug: 'b' },
      ]),
    )
    renderSidebar()
    const pinned = screen
      .getAllByRole('link')
      .filter((l) => /alpha|bravo/i.test(l.textContent ?? ''))
    expect(pinned.map((l) => l.textContent)).toEqual(['Alpha', 'Bravo'])
  })

  it('user menu surfaces the email', () => {
    renderSidebar()
    // Email shows in the trigger button text.
    expect(screen.getAllByText('tester@example.com').length).toBeGreaterThan(0)
  })
})
