import { queryOptions, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useRouterState } from '@tanstack/react-router'
import { useTheme } from 'next-themes'
import { useMemo, useState } from 'react'
import {
  ActionCommandGroup,
  JobCommandGroup,
  NavigationCommandGroup,
  RecentCommandGroup,
  SystemCommandGroup,
  WorkspaceCommandGroup,
} from '@/components/keyboard/CommandPalette.groups'
import { useKeyboard } from '@/components/keyboard/KeyboardProvider'
import { CommandDialog, CommandEmpty, CommandInput, CommandList } from '@/components/ui/command'
import { dashboardKeys } from '@/lib/dashboard/query-options'
import { jobKeys } from '@/lib/jobs/query-options'
import { listAllJobsFn } from '@/lib/jobs/server-fns'
import { fuzzyScore } from '@/lib/keyboard/fuzzy'
import { type RecentEntry, readRecents } from '@/lib/recents/store'
import { listWorkspacesFn } from '@/lib/workspaces/server-fns'
import type { User } from '@/shared/schemas/auth'

const paletteKeys = {
  workspaces: () => ['palette', 'workspaces'] as const,
  jobs: () => ['palette', 'jobs'] as const,
}

const paletteWorkspacesOptions = queryOptions({
  queryKey: paletteKeys.workspaces(),
  queryFn: () => listWorkspacesFn({ data: { includeArchived: false } }),
  staleTime: 60_000,
})

const paletteJobsOptions = queryOptions({
  queryKey: paletteKeys.jobs(),
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

  const workspacesQuery = useQuery({ ...paletteWorkspacesOptions, enabled: paletteOpen })
  const jobsQuery = useQuery({ ...paletteJobsOptions, enabled: paletteOpen })
  const workspaces = workspacesQuery.data ?? []
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

  const currentWorkspaceSlug = useMemo(() => {
    const match = routerState.match(/^\/workspaces\/([^/]+)/)
    return match?.[1]
  }, [routerState])

  const close = () => setPaletteOpen(false)

  const refreshJobs = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: jobKeys.lists() }),
      queryClient.invalidateQueries({ queryKey: paletteKeys.jobs() }),
      queryClient.invalidateQueries({ queryKey: dashboardKeys.all() }),
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
      <CommandInput placeholder="Search Workspaces, Jobs, actions..." />
      <CommandList>
        <CommandEmpty>No matches.</CommandEmpty>
        <RecentCommandGroup recents={recents} goTo={goTo} close={close} />
        <WorkspaceCommandGroup workspaces={workspaces} goTo={goTo} close={close} />
        <JobCommandGroup jobs={jobs} goTo={goTo} close={close} />
        <ActionCommandGroup
          jobs={actionableJobs}
          isAdmin={currentUser.role === 'admin'}
          currentWorkspaceSlug={currentWorkspaceSlug}
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
