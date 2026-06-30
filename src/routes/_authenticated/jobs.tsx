import { queryOptions, useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import type { ColumnDef } from '@tanstack/react-table'
import { Plus } from 'lucide-react'
import { z } from 'zod'
import { ContentChrome } from '@/components/ContentChrome'
import { DataTable } from '@/components/DataTable'
import { EmptyState } from '@/components/EmptyState'
import { JobSheet } from '@/components/forms/JobSheet'
import { StatusBadge } from '@/components/StatusBadge'
import { Button } from '@/components/ui/button'
import { isAdmin } from '@/lib/auth/is-admin'
import { formatInTimezone } from '@/lib/format'
import { effectiveTimezone } from '@/lib/jobs/queries'
import { listAllJobsFn } from '@/lib/jobs/server-fns'
import type { JobSummary } from '@/shared/schemas/job'

const allJobsQueryOptions = (filters: { status?: 'active' | 'paused' | 'archived' }) =>
  queryOptions({
    queryKey: ['jobs', filters],
    queryFn: () => listAllJobsFn({ data: filters }),
  })

const searchSchema = z.object({
  status: z.enum(['active', 'paused', 'archived']).optional(),
})

export const Route = createFileRoute('/_authenticated/jobs')({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({ status: search.status }),
  loader: ({ context, deps }) =>
    context.queryClient.ensureQueryData(
      allJobsQueryOptions({ ...(deps.status ? { status: deps.status } : {}) }),
    ),
  component: JobsPage,
})

const STATUSES = ['active', 'paused', 'archived'] as const

function columnsFor(): ColumnDef<JobSummary>[] {
  return [
    {
      accessorKey: 'name',
      header: 'Job',
      cell: ({ row }) => (
        <Link
          to="/jobs/$jobSlug"
          params={{ jobSlug: row.original.slug }}
          className="font-medium text-foreground hover:underline"
        >
          {row.original.name}
        </Link>
      ),
    },
    {
      accessorKey: 'triggerKind',
      header: 'Trigger',
      meta: { label: 'Trigger', filterVariant: 'select' },
    },
    {
      accessorKey: 'nextFireAt',
      header: 'Next run',
      cell: ({ row }) =>
        row.original.nextFireAt
          ? formatInTimezone(row.original.nextFireAt, effectiveTimezone(row.original))
          : 'Not scheduled',
    },
    {
      accessorKey: 'lastRunStartedAt',
      header: 'Last run',
      cell: ({ row }) =>
        row.original.lastRunStartedAt
          ? formatInTimezone(row.original.lastRunStartedAt, effectiveTimezone(row.original))
          : 'No Runs yet',
    },
    {
      accessorKey: 'status',
      header: 'Status',
      meta: { label: 'Status', filterVariant: 'select' },
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
  ]
}

function JobsPage() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const { currentUser, workspaceSlug } = Route.useRouteContext()
  const filters = { ...(search.status ? { status: search.status } : {}) }
  const { data: jobs } = useSuspenseQuery(allJobsQueryOptions(filters))
  const filtered = Boolean(search.status)

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-start justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Jobs</h1>
          <p className="text-sm text-muted-foreground">Scheduled calls to your Targets.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button render={<Link to="/" />} variant="outline" size="sm">
            ← Dashboard
          </Button>
          <JobSheet
            owner={{ workspaceSlug }}
            isAdmin={isAdmin(currentUser)}
            trigger={
              <Button>
                <Plus aria-hidden /> New Job
              </Button>
            }
          />
          <ContentChrome />
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant={search.status ? 'outline' : 'default'}
          size="xs"
          onClick={() => navigate({ search: (prev) => ({ ...prev, status: undefined }) })}
        >
          All
        </Button>
        {STATUSES.map((status) => (
          <Button
            key={status}
            variant={search.status === status ? 'default' : 'outline'}
            size="xs"
            onClick={() => navigate({ search: (prev) => ({ ...prev, status }) })}
          >
            {status}
          </Button>
        ))}
      </div>

      {jobs.length === 0 ? (
        filtered ? (
          <EmptyState
            title="No Jobs match these filters."
            description="Clear the filters to see every Job."
            action={
              <Button variant="outline" size="sm" onClick={() => navigate({ search: {} })}>
                Clear filters
              </Button>
            }
          />
        ) : (
          <EmptyState
            title="No Jobs yet."
            description="Create a Job to schedule calls to a Target."
            action={
              <JobSheet
                owner={{ workspaceSlug }}
                isAdmin={isAdmin(currentUser)}
                trigger={
                  <Button>
                    <Plus aria-hidden /> New Job
                  </Button>
                }
              />
            }
          />
        )
      ) : (
        <DataTable columns={columnsFor()} data={jobs} gridKey="jobs" />
      )}
    </div>
  )
}
