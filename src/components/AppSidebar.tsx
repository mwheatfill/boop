import { Link } from '@tanstack/react-router'
import {
  Activity,
  Bell,
  BookTemplate,
  Building2,
  History,
  Home,
  Pin,
  SendHorizonal,
  Target as TargetIcon,
  Waypoints,
} from 'lucide-react'
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
  to:
    | '/'
    | '/jobs'
    | '/runs'
    | '/templates'
    | '/targets'
    | '/tunnels'
    | '/channels'
    | '/alert-rules'
  icon: ComponentType<{ 'aria-hidden'?: boolean }>
  exact?: boolean
  adminOnly?: boolean
}

const NAV: NavItem[] = [
  { label: 'Home', to: '/', icon: Home, exact: true },
  { label: 'Jobs', to: '/jobs', icon: Activity },
  { label: 'Runs', to: '/runs', icon: History },
  { label: 'Targets', to: '/targets', icon: TargetIcon },
  { label: 'Tunnels', to: '/tunnels', icon: Waypoints },
  { label: 'Channels', to: '/channels', icon: SendHorizonal },
  { label: 'Alert Rules', to: '/alert-rules', icon: Bell },
  { label: 'Templates', to: '/templates', icon: BookTemplate },
]

type EntityKind = 'workspace' | 'job'

interface EntityRef {
  kind: EntityKind
  label: string
  slug: string
  workspaceSlug?: string
}

type EntityLinkProps = {
  entity: EntityRef
  icon: ComponentType<{ 'aria-hidden'?: boolean }>
} & Record<string, unknown>

function EntityLink({ entity, icon: Icon, ...slotProps }: EntityLinkProps): ReactNode {
  const body = (
    <>
      <Icon aria-hidden />
      <span>{entity.label}</span>
    </>
  )
  if (entity.kind === 'workspace') {
    return (
      <Link to="/" activeProps={{ 'data-active': 'true' }} {...slotProps}>
        {body}
      </Link>
    )
  }
  if (entity.workspaceSlug) {
    return (
      <Link
        to="/jobs/$jobSlug"
        params={{ jobSlug: entity.slug }}
        activeProps={{ 'data-active': 'true' }}
        {...slotProps}
      >
        {body}
      </Link>
    )
  }
  return <span {...slotProps}>{body}</span>
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
                  if (r.workspaceSlug) entity.workspaceSlug = r.workspaceSlug
                  return (
                    <SidebarMenuItem key={r.id}>
                      <SidebarMenuButton
                        tooltip={r.label}
                        render={
                          <EntityLink
                            entity={entity}
                            icon={r.entity === 'workspace' ? Building2 : Activity}
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
                Pin a Job from its detail page.
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
