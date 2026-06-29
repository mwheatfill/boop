import type { useNavigate } from '@tanstack/react-router'
import {
  ArrowRight,
  BookTemplate,
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
import { toast } from 'sonner'
import { CommandGroup, CommandItem, CommandShortcut } from '@/components/ui/command'
import { pauseJobFn, resumeJobFn, runJobNowFn } from '@/lib/jobs/server-fns'
import { formatKeyCombo } from '@/lib/keyboard/key-combo'
import type { RecentEntry } from '@/lib/recents/store'
import type { JobSummary } from '@/shared/schemas/job'
import type { Workspace } from '@/shared/schemas/workspace'

type PaletteNavigate = ReturnType<typeof useNavigate>

export function RecentCommandGroup({
  recents,
  goTo,
  close,
}: {
  recents: RecentEntry[]
  goTo: PaletteNavigate
  close: () => void
}) {
  if (recents.length === 0) return null
  return (
    <CommandGroup heading="Recent">
      {recents.map((r) => (
        <CommandItem
          key={`recent-${r.id}`}
          value={`recent ${r.label} ${r.slug}`}
          keywords={[r.slug, r.label]}
          onSelect={() => {
            close()
            if (r.entity === 'workspace') {
              void goTo({ to: '/' })
            } else if (r.workspaceSlug) {
              void goTo({
                to: '/jobs/$jobSlug',
                params: { jobSlug: r.slug },
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
  )
}

export function WorkspaceCommandGroup({
  workspaces,
  goTo,
  close,
}: {
  workspaces: Workspace[]
  goTo: PaletteNavigate
  close: () => void
}) {
  if (workspaces.length === 0) return null
  return (
    <CommandGroup heading="Workspaces">
      {workspaces.map((c) => (
        <CommandItem
          key={`workspace-${c.id}`}
          value={`workspace ${c.name} ${c.slug}`}
          keywords={[c.slug, c.name]}
          onSelect={() => {
            close()
            void goTo({ to: '/' })
          }}
        >
          <Building2 aria-hidden />
          <span>{c.name}</span>
          <span className="ml-2 font-mono text-xs text-muted-foreground">{c.slug}</span>
        </CommandItem>
      ))}
    </CommandGroup>
  )
}

export function JobCommandGroup({
  jobs,
  goTo,
  close,
}: {
  jobs: JobSummary[]
  goTo: PaletteNavigate
  close: () => void
}) {
  if (jobs.length === 0) return null
  return (
    <CommandGroup heading="Jobs">
      {jobs.map((j) => (
        <CommandItem
          key={`job-${j.id}`}
          value={`job ${j.name} ${j.slug} ${j.workspaceName}`}
          keywords={[j.slug, j.workspaceSlug, j.workspaceName]}
          onSelect={() => {
            close()
            void goTo({
              to: '/jobs/$jobSlug',
              params: { jobSlug: j.slug },
            })
          }}
        >
          <Briefcase aria-hidden />
          <span>{j.name}</span>
          <span className="ml-2 text-xs text-muted-foreground">{j.workspaceName}</span>
        </CommandItem>
      ))}
    </CommandGroup>
  )
}

export function ActionCommandGroup({
  jobs,
  isAdmin,
  currentWorkspaceSlug,
  goTo,
  close,
  refreshJobs,
}: {
  jobs: JobSummary[]
  isAdmin: boolean
  currentWorkspaceSlug: string | undefined
  goTo: PaletteNavigate
  close: () => void
  refreshJobs: () => Promise<void>
}) {
  return (
    <CommandGroup heading="Actions">
      {jobs.map((j) => (
        <CommandItem
          key={`action-runnow-${j.id}`}
          value={`run now ${j.name}`}
          keywords={['run', 'execute', 'trigger', j.slug]}
          onSelect={async () => {
            close()
            const result = await runJobNowFn({
              data: { workspaceSlug: j.workspaceSlug, jobSlug: j.slug },
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
      {jobs.map((j) => (
        <CommandItem
          key={`action-pause-${j.id}`}
          value={`${j.status === 'paused' ? 'resume' : 'pause'} ${j.name}`}
          keywords={[j.status === 'paused' ? 'resume' : 'pause', j.slug]}
          onSelect={async () => {
            close()
            const fn = j.status === 'paused' ? resumeJobFn : pauseJobFn
            const result = await fn({
              data: { workspaceSlug: j.workspaceSlug, jobSlug: j.slug },
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
          void goTo({ to: '/jobs' })
        }}
      >
        <Plus aria-hidden /> New Job
      </CommandItem>
      <CommandItem
        value="template library"
        keywords={['template', 'recipe', 'library']}
        onSelect={() => {
          close()
          void goTo({ to: '/templates' })
        }}
      >
        <BookTemplate aria-hidden /> Template library
      </CommandItem>
      {isAdmin ? (
        <CommandItem
          value="new workspace"
          keywords={['create', 'add', 'tenant', 'organization']}
          onSelect={() => {
            close()
            void goTo({ to: '/' })
          }}
        >
          <Plus aria-hidden /> New Workspace
        </CommandItem>
      ) : null}
      {isAdmin && currentWorkspaceSlug ? (
        <CommandItem
          value="new target"
          keywords={['create', 'add', 'endpoint', 'url']}
          onSelect={() => {
            close()
            void goTo({ to: '/targets' })
          }}
        >
          <Plus aria-hidden /> New Target
        </CommandItem>
      ) : null}
    </CommandGroup>
  )
}

export function NavigationCommandGroup({
  goTo,
  close,
}: {
  goTo: PaletteNavigate
  close: () => void
}) {
  const items = [
    {
      value: 'go home dashboard',
      keywords: ['dashboard', 'home'],
      to: '/',
      label: 'Go home',
      key: 'g h',
      icon: ArrowRight,
    },
    {
      value: 'go jobs',
      keywords: ['jobs'],
      to: '/jobs',
      label: 'Go to Jobs',
      key: 'g j',
      icon: ArrowRight,
    },
    {
      value: 'go workspaces',
      keywords: ['workspaces'],
      to: '/',
      label: 'Go to Workspaces',
      key: 'g c',
      icon: Users,
    },
    {
      value: 'go runs',
      keywords: ['runs', 'history'],
      to: '/runs',
      label: 'Go to Runs',
      key: 'g r',
      icon: ArrowRight,
    },
    {
      value: 'go templates',
      keywords: ['templates', 'library', 'recipes'],
      to: '/templates',
      label: 'Go to Templates',
      key: 'g l',
      icon: BookTemplate,
    },
  ] as const

  return (
    <CommandGroup heading="Navigation">
      {items.map((item) => {
        const Icon = item.icon
        return (
          <CommandItem
            key={item.value}
            value={item.value}
            keywords={[...item.keywords]}
            onSelect={() => {
              close()
              void goTo({ to: item.to })
            }}
          >
            <Icon aria-hidden /> {item.label}
            <CommandShortcut>{formatKeyCombo(item.key)}</CommandShortcut>
          </CommandItem>
        )
      })}
    </CommandGroup>
  )
}

export function SystemCommandGroup({
  theme,
  setTheme,
  close,
}: {
  theme: string | undefined
  setTheme: (theme: string) => void
  close: () => void
}) {
  return (
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
          toast.message('Press e on a detail page to edit.')
        }}
      >
        <Pencil aria-hidden /> Edit current entity
      </CommandItem>
    </CommandGroup>
  )
}
