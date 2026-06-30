import { queryOptions, useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import type { ColumnDef } from '@tanstack/react-table'
import { Plus } from 'lucide-react'
import { z } from 'zod'
import { DataTable } from '@/components/DataTable'
import { EmptyState } from '@/components/EmptyState'
import { JobSheet } from '@/components/forms/JobSheet'
import { StatusBadge } from '@/components/StatusBadge'
import { Button } from '@/components/ui/button'
import { isAdmin } from '@/lib/auth/is-admin'
import { formatInTimezone } from '@/lib/format'
import { triggerKindLabel } from '@/lib/jobs/format'
import { effectiveTimezone } from '@/lib/jobs/queries'
import { listAllJobsFn } from '@/lib/jobs/server-fns'
import type { JobSummary } from '@/shared/schemas/job'

const allJobsQueryOptions = (filters: { includeArchived?: boolean }) =>
  queryOptions({
    queryKey: ['jobs', filters],
    queryFn: () => listAllJobsFn({ data: filters }),
  })

const searchSchema = z.object({
  archived: z.boolean().optional(),
})

export const Route = createFileRoute('/_authenticated/jobs')({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({ archived: Boolean(search.archived) }),
  loader: ({ context, deps }) =>
    context.queryClient.ensureQueryData(allJobsQueryOptions({ includeArchived: deps.archived })),
  component: JobsPage,
})

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
      id: 'triggerKind',
      accessorFn: (row) => triggerKindLabel(row.triggerKind),
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
  const navigate = Route.useNavigate()
  const search = Route.useSearch()
  const { currentUser, workspaceSlug } = Route.useRouteContext()
  const archived = Boolean(search.archived)
  const { data: jobs } = useSuspenseQuery(allJobsQueryOptions({ includeArchived: archived }))

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
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate({ search: (prev) => ({ ...prev, archived: !archived }) })}
          >
            {archived ? 'Hide archived' : 'Show archived'}
          </Button>
          <JobSheet
            owner={{ workspaceSlug }}
            isAdmin={isAdmin(currentUser)}
            trigger={
              <Button size="sm">
                <Plus aria-hidden /> New Job
              </Button>
            }
          />
        </div>
      </header>

      {jobs.length === 0 ? (
        <EmptyState
          title={archived ? 'No archived Jobs.' : 'No Jobs yet.'}
          description={
            archived
              ? 'Toggle off "Show archived" to see active Jobs.'
              : 'Create a Job to schedule calls to a Target.'
          }
          action={
            archived ? undefined : (
              <JobSheet
                owner={{ workspaceSlug }}
                isAdmin={isAdmin(currentUser)}
                trigger={
                  <Button>
                    <Plus aria-hidden /> New Job
                  </Button>
                }
              />
            )
          }
        />
      ) : (
        <DataTable columns={columnsFor()} data={jobs} gridKey="jobs" />
      )}
    </div>
  )
}
