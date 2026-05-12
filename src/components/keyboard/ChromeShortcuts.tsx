import { useRightRail } from '@/components/right-rail/RightRailProvider'
import { useShortcut } from './use-shortcut'

export function ChromeShortcuts() {
  const rightRail = useRightRail()

  // SidebarProvider owns the actual Cmd+B toggle; this empty handler exists
  // only so the binding appears in the `?` cheatsheet.
  useShortcut('$mod+b', () => {}, { description: 'Toggle sidebar', section: 'global' })

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
