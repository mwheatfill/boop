import { queryOptions, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useRouterState } from '@tanstack/react-router'
import { useTheme } from 'next-themes'
import { useMemo, useState } from 'react'
import {
  ActionCommandGroup,
  CustomerCommandGroup,
  JobCommandGroup,
  NavigationCommandGroup,
  RecentCommandGroup,
  SystemCommandGroup,
} from '@/components/keyboard/CommandPalette.groups'
import { useKeyboard } from '@/components/keyboard/KeyboardProvider'
import { CommandDialog, CommandEmpty, CommandInput, CommandList } from '@/components/ui/command'
import { listCustomersFn } from '@/lib/customers/server-fns'
import { listAllJobsFn } from '@/lib/jobs/server-fns'
import { fuzzyScore } from '@/lib/keyboard/fuzzy'
import { type RecentEntry, readRecents } from '@/lib/recents/store'
import type { User } from '@/shared/schemas/auth'

const paletteCustomersOptions = queryOptions({
  queryKey: ['palette', 'customers'],
  queryFn: () => listCustomersFn({ data: { includeArchived: false } }),
  staleTime: 60_000,
})

const paletteJobsOptions = queryOptions({
  queryKey: ['palette', 'jobs'],
  queryFn: () => listAllJobsFn({ data: {} }),
  staleTime: 60_000,
})

interface CommandPaletteProps {
  currentUser: User
}

export function CommandPalette({ currentUser }: CommandPaletteProps) {
  const { paletteOpen, setPaletteOpen } = useKeyboard()
  const goTo = useNavigate()
  const queryClient = useQueryClient()
  const routerState = useRouterState({ select: (s) => s.location.pathname })
  const { setTheme, theme } = useTheme()

  const customersQuery = useQuery({ ...paletteCustomersOptions, enabled: paletteOpen })
  const jobsQuery = useQuery({ ...paletteJobsOptions, enabled: paletteOpen })
  const customers = customersQuery.data ?? []
  const jobs = jobsQuery.data ?? []
  const actionableJobs = useMemo(
    () => jobs.filter((j) => j.status === 'active' || j.status === 'paused').slice(0, 50),
    [jobs],
  )

  const [recents, setRecents] = useState<RecentEntry[]>([])
  const setPaletteOpenWithRecents = (open: boolean) => {
    if (open) setRecents(readRecents())
    setPaletteOpen(open)
  }

  const currentCustomerSlug = useMemo(() => {
    const match = routerState.match(/^\/customers\/([^/]+)/)
    return match?.[1]
  }, [routerState])

  const close = () => setPaletteOpen(false)

  const refreshJobs = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['jobs'] }),
      queryClient.invalidateQueries({ queryKey: ['palette', 'jobs'] }),
      queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
    ])
  }

  return (
    <CommandDialog
      open={paletteOpen}
      onOpenChange={setPaletteOpenWithRecents}
      label="Command palette"
      filter={(value, search, keywords) => fuzzyScore(value, search, keywords ?? [])}
      loop
    >
      <CommandInput placeholder="Search Customers, Jobs, actions..." />
      <CommandList>
        <CommandEmpty>No matches.</CommandEmpty>
        <RecentCommandGroup recents={recents} goTo={goTo} close={close} />
        <CustomerCommandGroup customers={customers} goTo={goTo} close={close} />
        <JobCommandGroup jobs={jobs} goTo={goTo} close={close} />
        <ActionCommandGroup
          jobs={actionableJobs}
          isAdmin={currentUser.role === 'admin'}
          currentCustomerSlug={currentCustomerSlug}
          goTo={goTo}
          close={close}
          refreshJobs={refreshJobs}
        />
        <NavigationCommandGroup goTo={goTo} close={close} />
        <SystemCommandGroup theme={theme} setTheme={setTheme} close={close} />
      </CommandList>
    </CommandDialog>
  )
}
