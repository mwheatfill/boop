import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { AppSidebar } from '@/components/AppSidebar'
import { CheatsheetDialog } from '@/components/keyboard/CheatsheetDialog'
import { ChordIndicator } from '@/components/keyboard/ChordIndicator'
import { ChromeShortcuts } from '@/components/keyboard/ChromeShortcuts'
import { CommandPalette } from '@/components/keyboard/CommandPalette'
import { GlobalShortcuts } from '@/components/keyboard/GlobalShortcuts'
import { KeyboardProvider } from '@/components/keyboard/KeyboardProvider'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { useLocalStorage } from '@/lib/use-local-storage'
import { defaultWorkspaceQueryOptions } from '@/lib/workspaces/query-options'

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async ({ context, location }) => {
    if (!context.currentUser) {
      throw redirect({
        to: '/login',
        search: { redirect: location.href },
      })
    }
    // Single-workspace (ADR-027): resolve the one Workspace once and expose its
    // slug to every child route. When multi-workspace returns, routes take a
    // $workspaceSlug param again and this collapses back out.
    const workspace = await context.queryClient.ensureQueryData(defaultWorkspaceQueryOptions)
    return { currentUser: context.currentUser, workspaceSlug: workspace.slug }
  },
  component: AuthenticatedLayout,
})

const SIDEBAR_OPEN_STORAGE_KEY = 'boop.sidebar-open'
const PARSE_BOOL = (v: unknown) => (typeof v === 'boolean' ? v : null)

function AuthenticatedLayout() {
  const { currentUser } = Route.useRouteContext()
  const [sidebarOpen, setSidebarOpen] = useLocalStorage<boolean>(SIDEBAR_OPEN_STORAGE_KEY, true, {
    parse: PARSE_BOOL,
  })

  return (
    <KeyboardProvider>
      <SidebarProvider open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <AppSidebar user={currentUser} />
        <SidebarInset className="flex min-w-0 flex-1 flex-col">
          <main className="min-w-0 flex-1 overflow-x-hidden px-4 py-6 md:px-6 lg:px-8">
            <Outlet />
          </main>
        </SidebarInset>
        <GlobalShortcuts currentUser={currentUser} />
        <ChromeShortcuts />
        <CommandPalette currentUser={currentUser} />
        <CheatsheetDialog />
        <ChordIndicator />
      </SidebarProvider>
    </KeyboardProvider>
  )
}
