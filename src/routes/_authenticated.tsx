import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { CheatsheetDialog } from '@/components/keyboard/CheatsheetDialog'
import { ChordIndicator } from '@/components/keyboard/ChordIndicator'
import { CommandPalette } from '@/components/keyboard/CommandPalette'
import { GlobalShortcuts } from '@/components/keyboard/GlobalShortcuts'
import { KeyboardProvider } from '@/components/keyboard/KeyboardProvider'

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: ({ context, location }) => {
    if (!context.currentUser) {
      throw redirect({
        to: '/login',
        search: { redirect: location.href },
      })
    }
    return { currentUser: context.currentUser }
  },
  component: AuthenticatedLayout,
})

function AuthenticatedLayout() {
  const { currentUser } = Route.useRouteContext()
  return (
    <KeyboardProvider>
      <GlobalShortcuts currentUser={currentUser} />
      <CommandPalette currentUser={currentUser} />
      <CheatsheetDialog />
      <ChordIndicator />
      <Outlet />
    </KeyboardProvider>
  )
}
