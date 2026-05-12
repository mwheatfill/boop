import { useNavigate, useRouterState } from '@tanstack/react-router'
import { toast } from 'sonner'
import type { User } from '@/shared/schemas/auth'
import { useKeyboard } from './KeyboardProvider'
import { useShortcut } from './use-shortcut'

interface GlobalShortcutsProps {
  currentUser: User
}

export function GlobalShortcuts({ currentUser }: GlobalShortcutsProps) {
  const navigate = useNavigate()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const { paletteOpen, setPaletteOpen, cheatsheetOpen, setCheatsheetOpen } = useKeyboard()
  const isAdmin = currentUser.role === 'admin'

  useShortcut('$mod+k', () => setPaletteOpen(!paletteOpen), {
    description: 'Open command palette',
    section: 'global',
  })

  useShortcut('?', () => setCheatsheetOpen(!cheatsheetOpen), {
    description: 'Open keyboard cheatsheet',
    section: 'global',
  })

  useShortcut('g h', () => void navigate({ to: '/' }), {
    description: 'Go home',
    section: 'navigation',
  })
  useShortcut('g j', () => void navigate({ to: '/jobs' }), {
    description: 'Go to Jobs',
    section: 'navigation',
  })
  useShortcut('g c', () => void navigate({ to: '/customers' }), {
    description: 'Go to Customers',
    section: 'navigation',
  })
  useShortcut('g r', () => void navigate({ to: '/runs' }), {
    description: 'Go to Runs',
    section: 'navigation',
  })

  useShortcut('n j', () => void navigate({ to: '/jobs/new' }), {
    description: 'New Job',
    section: 'navigation',
  })

  useShortcut(
    'n c',
    () => {
      if (!isAdmin) {
        toast.error('Admin only.')
        return
      }
      void navigate({ to: '/customers/new' })
    },
    { description: 'New Customer (Admin)', section: 'navigation' },
  )

  useShortcut(
    'n t',
    () => {
      if (!isAdmin) {
        toast.error('Admin only.')
        return
      }
      const match = pathname.match(/^\/customers\/([^/]+)/)
      const customerSlug = match?.[1]
      if (!customerSlug) {
        toast.error('Open a Customer hub first to add a Target.')
        return
      }
      void navigate({
        to: '/customers/$customerSlug/targets/new',
        params: { customerSlug },
      })
    },
    { description: 'New Target (Admin, current Customer)', section: 'navigation' },
  )

  return null
}
