import { Link } from '@tanstack/react-router'
import { Activity, Bell, Building2, History, Home, Pin, SendHorizonal } from 'lucide-react'
import type { ComponentType, ReactNode } from 'react'
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

interface AppSidebarProps {
  user: User
}

interface NavItem {
  label: string
  to: '/' | '/jobs' | '/customers' | '/runs' | '/channels' | '/alert-rules'
  icon: ComponentType<{ 'aria-hidden'?: boolean }>
  exact?: boolean
  adminOnly?: boolean
}

const NAV: NavItem[] = [
  { label: 'Home', to: '/', icon: Home, exact: true },
  { label: 'Jobs', to: '/jobs', icon: Activity },
  { label: 'Customers', to: '/customers', icon: Building2 },
  { label: 'Runs', to: '/runs', icon: History },
  { label: 'Channels', to: '/channels', icon: SendHorizonal, adminOnly: true },
  { label: 'Alert Rules', to: '/alert-rules', icon: Bell, adminOnly: true },
]

type EntityKind = 'customer' | 'job'

interface EntityRef {
  kind: EntityKind
  label: string
  slug: string
  customerSlug?: string
}

function EntityLink({
  entity,
  icon: Icon,
}: {
  entity: EntityRef
  icon: ComponentType<{ 'aria-hidden'?: boolean }>
}): ReactNode {
  if (entity.kind === 'customer') {
    return (
      <Link
        to="/customers/$customerSlug"
        params={{ customerSlug: entity.slug }}
        activeProps={{ 'data-active': 'true' }}
      >
        <Icon aria-hidden />
        <span>{entity.label}</span>
      </Link>
    )
  }
  if (entity.customerSlug) {
    return (
      <Link
        to="/customers/$customerSlug/jobs/$jobSlug"
        params={{ customerSlug: entity.customerSlug, jobSlug: entity.slug }}
        activeProps={{ 'data-active': 'true' }}
      >
        <Icon aria-hidden />
        <span>{entity.label}</span>
      </Link>
    )
  }
  return (
    <span>
      <Icon aria-hidden />
      <span>{entity.label}</span>
    </span>
  )
}

export function AppSidebar({ user }: AppSidebarProps) {
  const recents = useRecents()
  const { pinned } = usePinned()
  const isAdmin = user.role === 'admin'
  const navItems = NAV.filter((item) => !item.adminOnly || isAdmin)

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
              {navItems.map((item) => (
                <SidebarMenuItem key={item.to}>
                  <SidebarMenuButton
                    tooltip={item.label}
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
              ))}
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
                {recents.map((r) => {
                  const entity: EntityRef = { kind: r.entity, label: r.label, slug: r.slug }
                  if (r.customerSlug) entity.customerSlug = r.customerSlug
                  return (
                    <SidebarMenuItem key={r.id}>
                      <SidebarMenuButton
                        tooltip={r.label}
                        render={
                          <EntityLink
                            entity={entity}
                            icon={r.entity === 'customer' ? Building2 : Activity}
                          />
                        }
                      />
                    </SidebarMenuItem>
                  )
                })}
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
                      render={<EntityLink entity={p} icon={Pin} />}
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
