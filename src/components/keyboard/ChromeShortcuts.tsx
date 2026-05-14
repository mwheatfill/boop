import { useShortcut } from './use-shortcut'

export function ChromeShortcuts() {
  // SidebarProvider owns the actual Cmd+B toggle; this empty handler exists
  // only so the binding appears in the `?` cheatsheet.
  useShortcut('$mod+b', () => {}, { description: 'Toggle sidebar', section: 'global' })
  return null
}
