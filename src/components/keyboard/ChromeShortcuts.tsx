import { useRightRail } from '@/components/right-rail/RightRailProvider'
import { useShortcut } from './use-shortcut'

/**
 * Chrome-level shortcuts registered through PRD #43's `useShortcut` so they
 * appear in the `?` cheatsheet and respect the input-skip guard:
 *
 * - `$mod+b` is wired by the shadcn `SidebarProvider` itself; the entry
 *   here is no-op handler purely for cheatsheet visibility. Calling
 *   `toggleSidebar()` here would double-toggle since the shadcn handler
 *   also fires.
 * - `]` toggles the right rail when one is available on the current route.
 *
 * Mounted inside `<SidebarProvider>` + `<RightRailProvider>`.
 */
export function ChromeShortcuts() {
  const rightRail = useRightRail()

  useShortcut(
    '$mod+b',
    () => {
      // No-op: the shadcn SidebarProvider owns the actual toggle via its
      // own window keydown listener. This registration exists so the
      // binding is discoverable in the `?` cheatsheet.
    },
    { description: 'Toggle sidebar', section: 'global' },
  )

  useShortcut(
    ']',
    () => {
      if (rightRail.routeId) rightRail.toggle()
    },
    {
      description: 'Toggle properties panel',
      section: 'global',
      disabled: rightRail.routeId === null,
    },
  )

  return null
}
