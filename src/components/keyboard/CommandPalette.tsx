import { queryOptions, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useRouterState } from '@tanstack/react-router'
import {
  ArrowRight,
  Briefcase,
  Building2,
  History,
  PauseCircle,
  Pencil,
  Play,
  Plus,
  SunMoon,
  Users,
} from 'lucide-react'
import { useTheme } from 'next-themes'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { useKeyboard } from '@/components/keyboard/KeyboardProvider'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from '@/components/ui/command'
import { listCustomersFn } from '@/lib/customers/server-fns'
import { listAllJobsFn, pauseJobFn, resumeJobFn, runJobNowFn } from '@/lib/jobs/server-fns'
import { fuzzyScore } from '@/lib/keyboard/fuzzy'
import { renderKeyCombo } from '@/lib/keyboard/key-combo'
import { type RecentEntry, readRecents } from '@/lib/recents/store'
import type { User } from '@/shared/schemas/auth'
import type { Customer } from '@/shared/schemas/customer'
import type { JobSummary } from '@/shared/schemas/job'

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
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const routerState = useRouterState({ select: (s) => s.location.pathname })
  const { setTheme, theme } = useTheme()

  const customersQuery = useQuery({ ...paletteCustomersOptions, enabled: paletteOpen })
  const jobsQuery = useQuery({ ...paletteJobsOptions, enabled: paletteOpen })
  const customers = customersQuery.data ?? []
  const jobs = jobsQuery.data ?? []

  const [recents, setRecents] = useState<RecentEntry[]>([])
  useEffect(() => {
    if (paletteOpen) setRecents(readRecents())
  }, [paletteOpen])

  const currentCustomerSlug = useMemo(() => {
    const match = routerState.match(/^\/customers\/([^/]+)/)
    return match?.[1]
  }, [routerState])

  const isAdmin = currentUser.role === 'admin'
  const close = () => setPaletteOpen(false)

  const refreshJobs = async () => {
    await queryClient.invalidateQueries({ queryKey: ['jobs'] })
    await queryClient.invalidateQueries({ queryKey: ['palette', 'jobs'] })
    await queryClient.invalidateQueries({ queryKey: ['dashboard'] })
  }

  return (
    <CommandDialog
      open={paletteOpen}
      onOpenChange={setPaletteOpen}
      label="Command palette"
      filter={(value, search, keywords) => fuzzyScore(value, search, keywords ?? [])}
      loop
    >
      <CommandInput placeholder="Search Customers, Jobs, actions…" autoFocus />
      <CommandList>
        <CommandEmpty>No matches.</CommandEmpty>

        {recents.length > 0 ? (
          <CommandGroup heading="Recent">
            {recents.map((r) => (
              <CommandItem
                key={`recent-${r.id}`}
                value={`recent ${r.label} ${r.slug}`}
                keywords={[r.slug, r.label]}
                onSelect={() => {
                  close()
                  if (r.entity === 'customer') {
                    void navigate({
                      to: '/customers/$customerSlug',
                      params: { customerSlug: r.slug },
                    })
                  } else if (r.customerSlug) {
                    void navigate({
                      to: '/customers/$customerSlug/jobs/$jobSlug',
                      params: { customerSlug: r.customerSlug, jobSlug: r.slug },
                    })
                  }
                }}
              >
                <History aria-hidden />
                <span>{r.label}</span>
                <span className="ml-2 font-mono text-xs text-muted-foreground">{r.slug}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}

        {customers.length > 0 ? (
          <CommandGroup heading="Customers">
            {customers.map((c: Customer) => (
              <CommandItem
                key={`customer-${c.id}`}
                value={`customer ${c.name} ${c.slug}`}
                keywords={[c.slug, c.name]}
                onSelect={() => {
                  close()
                  void navigate({
                    to: '/customers/$customerSlug',
                    params: { customerSlug: c.slug },
                  })
                }}
              >
                <Building2 aria-hidden />
                <span>{c.name}</span>
                <span className="ml-2 font-mono text-xs text-muted-foreground">{c.slug}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}

        {jobs.length > 0 ? (
          <CommandGroup heading="Jobs">
            {jobs.map((j: JobSummary) => (
              <CommandItem
                key={`job-${j.id}`}
                value={`job ${j.name} ${j.slug} ${j.customerName}`}
                keywords={[j.slug, j.customerSlug, j.customerName]}
                onSelect={() => {
                  close()
                  void navigate({
                    to: '/customers/$customerSlug/jobs/$jobSlug',
                    params: { customerSlug: j.customerSlug, jobSlug: j.slug },
                  })
                }}
              >
                <Briefcase aria-hidden />
                <span>{j.name}</span>
                <span className="ml-2 text-xs text-muted-foreground">{j.customerName}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}

        <CommandGroup heading="Actions">
          {jobs
            .filter((j) => j.status === 'active' || j.status === 'paused')
            .slice(0, 50)
            .map((j) => (
              <CommandItem
                key={`action-runnow-${j.id}`}
                value={`run now ${j.name}`}
                keywords={['run', 'execute', 'trigger', j.slug]}
                onSelect={async () => {
                  close()
                  const result = await runJobNowFn({
                    data: { customerSlug: j.customerSlug, jobSlug: j.slug },
                  })
                  if (result.ok) {
                    toast.success(`Run queued for ${j.name}`)
                    await refreshJobs()
                  } else {
                    toast.error(result.message ?? 'Could not queue Run')
                  }
                }}
              >
                <Play aria-hidden /> Run now <span className="text-muted-foreground">{j.name}</span>
              </CommandItem>
            ))}
          {jobs
            .filter((j) => j.status === 'active' || j.status === 'paused')
            .slice(0, 50)
            .map((j) => (
              <CommandItem
                key={`action-pause-${j.id}`}
                value={`${j.status === 'paused' ? 'resume' : 'pause'} ${j.name}`}
                keywords={[j.status === 'paused' ? 'resume' : 'pause', j.slug]}
                onSelect={async () => {
                  close()
                  const fn = j.status === 'paused' ? resumeJobFn : pauseJobFn
                  const result = await fn({
                    data: { customerSlug: j.customerSlug, jobSlug: j.slug },
                  })
                  if (result.ok) {
                    toast.success(j.status === 'paused' ? 'Resumed' : 'Paused')
                    await refreshJobs()
                  } else {
                    toast.error(result.message ?? 'Could not change status')
                  }
                }}
              >
                {j.status === 'paused' ? (
                  <>
                    <Play aria-hidden /> Resume
                  </>
                ) : (
                  <>
                    <PauseCircle aria-hidden /> Pause
                  </>
                )}
                <span className="text-muted-foreground">{j.name}</span>
              </CommandItem>
            ))}
          <CommandItem
            value="new job"
            keywords={['create', 'add']}
            onSelect={() => {
              close()
              void navigate({ to: '/jobs/new' })
            }}
          >
            <Plus aria-hidden /> New Job
          </CommandItem>
          {isAdmin ? (
            <CommandItem
              value="new customer"
              keywords={['create', 'add', 'tenant', 'organization']}
              onSelect={() => {
                close()
                void navigate({ to: '/customers/new' })
              }}
            >
              <Plus aria-hidden /> New Customer
            </CommandItem>
          ) : null}
          {isAdmin && currentCustomerSlug ? (
            <CommandItem
              value="new target"
              keywords={['create', 'add', 'endpoint', 'url']}
              onSelect={() => {
                close()
                void navigate({
                  to: '/customers/$customerSlug/targets/new',
                  params: { customerSlug: currentCustomerSlug },
                })
              }}
            >
              <Plus aria-hidden /> New Target
            </CommandItem>
          ) : null}
        </CommandGroup>

        <CommandGroup heading="Navigation">
          <CommandItem
            value="go home dashboard"
            keywords={['dashboard', 'home']}
            onSelect={() => {
              close()
              void navigate({ to: '/' })
            }}
          >
            <ArrowRight aria-hidden /> Go home
            <CommandShortcut>{renderKeyCombo('g h').join(' ')}</CommandShortcut>
          </CommandItem>
          <CommandItem
            value="go jobs"
            keywords={['jobs']}
            onSelect={() => {
              close()
              void navigate({ to: '/jobs' })
            }}
          >
            <ArrowRight aria-hidden /> Go to Jobs
            <CommandShortcut>{renderKeyCombo('g j').join(' ')}</CommandShortcut>
          </CommandItem>
          <CommandItem
            value="go customers"
            keywords={['customers']}
            onSelect={() => {
              close()
              void navigate({ to: '/customers' })
            }}
          >
            <Users aria-hidden /> Go to Customers
            <CommandShortcut>{renderKeyCombo('g c').join(' ')}</CommandShortcut>
          </CommandItem>
          <CommandItem
            value="go runs"
            keywords={['runs', 'history']}
            onSelect={() => {
              close()
              void navigate({ to: '/runs' })
            }}
          >
            <ArrowRight aria-hidden /> Go to Runs
            <CommandShortcut>{renderKeyCombo('g r').join(' ')}</CommandShortcut>
          </CommandItem>
        </CommandGroup>

        <CommandGroup heading="System">
          <CommandItem
            value="toggle theme"
            keywords={['dark', 'light', 'mode']}
            onSelect={() => {
              close()
              setTheme(theme === 'dark' ? 'light' : 'dark')
            }}
          >
            <SunMoon aria-hidden /> Toggle theme
          </CommandItem>
          <CommandItem
            value="edit"
            keywords={['edit']}
            onSelect={() => {
              close()
              // Edit: route param dependent; users should invoke `e` instead.
              toast.message('Press e on a detail page to edit.')
            }}
          >
            <Pencil aria-hidden /> Edit current entity
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
