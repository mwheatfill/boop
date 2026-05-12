import { Link, useRouterState } from '@tanstack/react-router'
import { Activity, Building2, History, Home, Pin } from 'lucide-react'
import type { ComponentType } from 'react'
import { ThemeToggle } from '@/components/ThemeToggle'
import { UserMenu } from '@/components/UserMenu'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from '@/components/ui/sidebar'
import { usePinned } from '@/lib/pinned/use-pinned'
import { useRecents } from '@/lib/recents/use-recents'
import type { User } from '@/shared/schemas/auth'

function isPathActive(pathname: string, target: string, exact: boolean): boolean {
  if (exact) return pathname === target
  return pathname === target || pathname.startsWith(`${target}/`)
}

interface AppSidebarProps {
  user: User
}

interface NavItem {
  label: string
  to: '/' | '/jobs' | '/customers' | '/runs'
  icon: ComponentType<{ 'aria-hidden'?: boolean }>
  /** Active-state matches the exact path so `/` doesn't light up everywhere. */
  exact?: boolean
}

const NAV: NavItem[] = [
  { label: 'Home', to: '/', icon: Home, exact: true },
  { label: 'Jobs', to: '/jobs', icon: Activity },
  { label: 'Customers', to: '/customers', icon: Building2 },
  { label: 'Runs', to: '/runs', icon: History },
]

/**
 * The inverted-L workspace sidebar. Composes the shadcn `sidebar` primitive
 * with boop's nav. Per DESIGN.md § 4 the chrome stays tight; density does
 * not affect the sidebar.
 *
 * - Primary nav rendered via `<SidebarMenuButton asChild>` so the TanStack
 *   Router `<Link>` provides active state via the `data-status="active"`
 *   attribute (set by `activeProps`). The button's CSS keys off
 *   `data-active=true` (canonical shadcn selector) — the wrapper sets it
 *   to mirror the router's data-status, since shadcn's `isActive` prop
 *   wants a boolean while TanStack sets it as an attribute.
 *
 * - Recent shares `boop.recents` with the Cmd+K palette (PRD #43).
 * - Pinned reads `boop.pins` via `usePinned()`.
 */
export function AppSidebar({ user }: AppSidebarProps) {
  const recents = useRecents()
  const { pinned } = usePinned()
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <Link to="/" className="flex items-center gap-2 px-2 py-1.5">
          <span
            aria-hidden
            className="inline-flex size-6 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground text-xs font-semibold"
          >
            b
          </span>
          <span className="text-sm font-semibold tracking-tight group-data-[collapsible=icon]:hidden">
            boop
          </span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV.map((item) => {
                const active = isPathActive(pathname, item.to, item.exact ?? false)
                return (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton
                      tooltip={item.label}
                      isActive={active}
                      render={
                        <Link
                          to={item.to}
                          {...(item.exact ? { activeOptions: { exact: true } } : {})}
                          activeProps={{ 'data-active': 'true' }}
                        >
                          <item.icon aria-hidden />
                          <span>{item.label}</span>
                        </Link>
                      }
                    />
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Recent</SidebarGroupLabel>
          <SidebarGroupContent>
            {recents.length === 0 ? (
              <p className="px-2 py-1 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
                Visited entities will appear here.
              </p>
            ) : (
              <SidebarMenu>
                {recents.map((r) => (
                  <SidebarMenuItem key={r.id}>
                    <SidebarMenuButton
                      tooltip={r.label}
                      render={
                        r.entity === 'customer' ? (
                          <Link
                            to="/customers/$customerSlug"
                            params={{ customerSlug: r.slug }}
                            activeProps={{ 'data-active': 'true' }}
                          >
                            <Building2 aria-hidden />
                            <span>{r.label}</span>
                          </Link>
                        ) : r.customerSlug ? (
                          <Link
                            to="/customers/$customerSlug/jobs/$jobSlug"
                            params={{ customerSlug: r.customerSlug, jobSlug: r.slug }}
                            activeProps={{ 'data-active': 'true' }}
                          >
                            <Activity aria-hidden />
                            <span>{r.label}</span>
                          </Link>
                        ) : (
                          <span>
                            <History aria-hidden />
                            <span>{r.label}</span>
                          </span>
                        )
                      }
                    />
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            )}
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Pinned</SidebarGroupLabel>
          <SidebarGroupContent>
            {pinned.length === 0 ? (
              <p className="px-2 py-1 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
                Pin a Customer or Job from its detail page.
              </p>
            ) : (
              <SidebarMenu>
                {pinned.map((p) => (
                  <SidebarMenuItem key={`${p.kind}:${p.id}`}>
                    <SidebarMenuButton
                      tooltip={p.label}
                      render={
                        p.kind === 'customer' ? (
                          <Link
                            to="/customers/$customerSlug"
                            params={{ customerSlug: p.slug }}
                            activeProps={{ 'data-active': 'true' }}
                          >
                            <Pin aria-hidden />
                            <span>{p.label}</span>
                          </Link>
                        ) : p.customerSlug ? (
                          <Link
                            to="/customers/$customerSlug/jobs/$jobSlug"
                            params={{ customerSlug: p.customerSlug, jobSlug: p.slug }}
                            activeProps={{ 'data-active': 'true' }}
                          >
                            <Pin aria-hidden />
                            <span>{p.label}</span>
                          </Link>
                        ) : (
                          <span>
                            <Pin aria-hidden />
                            <span>{p.label}</span>
                          </span>
                        )
                      }
                    />
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            )}
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <div className="flex items-center justify-between gap-2 px-1 group-data-[collapsible=icon]:hidden">
          <ThemeToggle />
        </div>
        <SidebarMenu>
          <SidebarMenuItem>
            <UserMenu user={user} />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
