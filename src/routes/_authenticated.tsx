import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { useCallback, useEffect, useState } from 'react'
import { AppSidebar } from '@/components/AppSidebar'
import { CheatsheetDialog } from '@/components/keyboard/CheatsheetDialog'
import { ChordIndicator } from '@/components/keyboard/ChordIndicator'
import { ChromeShortcuts } from '@/components/keyboard/ChromeShortcuts'
import { CommandPalette } from '@/components/keyboard/CommandPalette'
import { GlobalShortcuts } from '@/components/keyboard/GlobalShortcuts'
import { KeyboardProvider } from '@/components/keyboard/KeyboardProvider'
import { RightRail } from '@/components/right-rail/RightRail'
import { RightRailProvider } from '@/components/right-rail/RightRailProvider'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'

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

const SIDEBAR_OPEN_STORAGE_KEY = 'boop.sidebar-open'

function readSidebarOpen(): boolean {
  if (typeof localStorage === 'undefined') return true
  try {
    const raw = localStorage.getItem(SIDEBAR_OPEN_STORAGE_KEY)
    if (raw === 'false') return false
    if (raw === 'true') return true
    return true
  } catch {
    return true
  }
}

function writeSidebarOpen(open: boolean): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(SIDEBAR_OPEN_STORAGE_KEY, String(open))
  } catch {
    // Quota; degrade silently.
  }
}

function AuthenticatedLayout() {
  const { currentUser } = Route.useRouteContext()

  // SSR-safe: server render with the canonical default; the client effect
  // below realigns to the persisted preference on mount.
  const [sidebarOpen, setSidebarOpen] = useState(true)
  useEffect(() => {
    setSidebarOpen(readSidebarOpen())
  }, [])

  const onSidebarOpenChange = useCallback((next: boolean) => {
    setSidebarOpen(next)
    writeSidebarOpen(next)
  }, [])

  return (
    <KeyboardProvider>
      <SidebarProvider open={sidebarOpen} onOpenChange={onSidebarOpenChange}>
        <RightRailProvider>
          <AppSidebar user={currentUser} />
          <SidebarInset className="flex min-w-0 flex-1 flex-col">
            <div className="flex min-w-0 flex-1">
              <main className="min-w-0 flex-1 overflow-x-hidden px-4 py-6 md:px-6 lg:px-8">
                <Outlet />
              </main>
              <RightRail />
            </div>
          </SidebarInset>
          <GlobalShortcuts currentUser={currentUser} />
          <ChromeShortcuts />
          <CommandPalette currentUser={currentUser} />
          <CheatsheetDialog />
          <ChordIndicator />
        </RightRailProvider>
      </SidebarProvider>
    </KeyboardProvider>
  )
}
