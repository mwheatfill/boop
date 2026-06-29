import { useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import type { User } from '@/shared/schemas/auth'
import { useKeyboard } from './KeyboardProvider'
import { useShortcut } from './use-shortcut'

interface GlobalShortcutsProps {
  currentUser: User
}

export function GlobalShortcuts({ currentUser }: GlobalShortcutsProps) {
  const navigate = useNavigate()
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
  useShortcut('g c', () => void navigate({ to: '/' }), {
    description: 'Go to Workspaces',
    section: 'navigation',
  })
  useShortcut('g r', () => void navigate({ to: '/runs' }), {
    description: 'Go to Runs',
    section: 'navigation',
  })
  useShortcut('g l', () => void navigate({ to: '/templates' }), {
    description: 'Go to Templates',
    section: 'navigation',
  })

  useShortcut('n j', () => void navigate({ to: '/jobs' }), {
    description: 'Go to Jobs',
    section: 'navigation',
  })

  useShortcut('n l', () => void navigate({ to: '/templates' }), {
    description: 'Open template library',
    section: 'navigation',
  })

  useShortcut(
    'n c',
    () => {
      if (!isAdmin) {
        toast.error('Admin only.')
        return
      }
      void navigate({ to: '/' })
    },
    { description: 'New Workspace (Admin)', section: 'navigation' },
  )

  useShortcut(
    'n t',
    () => {
      if (!isAdmin) {
        toast.error('Admin only.')
        return
      }
      void navigate({ to: '/targets' })
    },
    { description: 'Go to Targets (Admin, current Workspace)', section: 'navigation' },
  )

  useShortcut(
    'n h',
    () => {
      if (!isAdmin) {
        toast.error('Admin only.')
        return
      }
      void navigate({ to: '/channels' })
    },
    { description: 'Go to Channels (Admin, current Workspace)', section: 'navigation' },
  )

  useShortcut(
    'n a',
    () => {
      void navigate({ to: '/alert-rules' })
    },
    { description: 'Go to Alert Rules (current Workspace)', section: 'navigation' },
  )

  return null
}
