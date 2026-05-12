import { Link } from '@tanstack/react-router'
import { LogOut, User as UserIcon } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { SidebarMenuButton } from '@/components/ui/sidebar'
import type { User } from '@/shared/schemas/auth'

interface UserMenuProps {
  user: User
}

/**
 * Sidebar-footer dropdown carrying the operator's identity + sign out.
 * Sign out routes to Cloudflare Access's logout endpoint per ADR-005's
 * default auth recipe. Auth recipes that ship a different sign-out flow
 * override `<UserMenu>` from within their recipe.
 */
export function UserMenu({ user }: UserMenuProps) {
  const initials = (user.name ?? user.email)
    .split(/[\s.@]+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <SidebarMenuButton size="lg" tooltip={user.email}>
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-medium uppercase">
              {initials || <UserIcon aria-hidden className="size-4" />}
            </span>
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-medium">{user.name ?? user.email}</span>
              <span className="truncate text-xs text-muted-foreground">{user.email}</span>
            </div>
          </SidebarMenuButton>
        }
      />
      <DropdownMenuContent align="start" side="right" sideOffset={8} className="min-w-56">
        <DropdownMenuLabel className="flex flex-col">
          <span className="text-xs font-normal text-muted-foreground">Signed in as</span>
          <span className="font-medium">{user.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          render={
            <Link to="/me">
              <UserIcon aria-hidden /> Account
            </Link>
          }
        />
        <DropdownMenuItem
          render={
            <a href="/cdn-cgi/access/logout">
              <LogOut aria-hidden /> Sign out
            </a>
          }
        />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
