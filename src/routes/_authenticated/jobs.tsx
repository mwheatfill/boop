import { queryOptions, useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import type { ColumnDef } from '@tanstack/react-table'
import { z } from 'zod'
import { DataTable } from '@/components/DataTable'
import { EmptyState } from '@/components/EmptyState'
import { StatusBadge } from '@/components/StatusBadge'
import { Button } from '@/components/ui/button'
import { listAllJobsFn } from '@/lib/jobs/server-fns'
import type { JobSummary } from '@/shared/schemas/job'

const allJobsQueryOptions = (filters: {
  customerSlug?: string
  status?: 'active' | 'paused' | 'archived'
}) =>
  queryOptions({
    queryKey: ['jobs', filters],
    queryFn: () => listAllJobsFn({ data: filters }),
  })

const searchSchema = z.object({
  customer: z.string().optional(),
  status: z.enum(['active', 'paused', 'archived']).optional(),
})

export const Route = createFileRoute('/_authenticated/jobs')({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({
    customerSlug: search.customer,
    status: search.status,
  }),
  loader: ({ context, deps }) =>
    context.queryClient.ensureQueryData(
      allJobsQueryOptions({
        ...(deps.customerSlug ? { customerSlug: deps.customerSlug } : {}),
        ...(deps.status ? { status: deps.status } : {}),
      }),
    ),
  component: JobsPage,
})

const STATUSES = ['active', 'paused', 'archived'] as const

function columnsFor(): ColumnDef<JobSummary>[] {
  return [
    {
      accessorKey: 'customerName',
      header: 'Customer',
      cell: ({ row }) => (
        <Link
          to="/customers/$customerSlug"
          params={{ customerSlug: row.original.customerSlug }}
          className="text-sm hover:underline"
        >
          {row.original.customerName}
        </Link>
      ),
    },
    {
      accessorKey: 'name',
      header: 'Job',
      cell: ({ row }) => (
        <Link
          to="/customers/$customerSlug/jobs/$jobSlug"
          params={{ customerSlug: row.original.customerSlug, jobSlug: row.original.slug }}
          className="font-medium text-foreground hover:underline"
        >
          {row.original.name}
        </Link>
      ),
    },
    { accessorKey: 'triggerKind', header: 'Trigger' },
    {
      accessorKey: 'nextFireAt',
      header: 'Next run',
      cell: ({ row }) =>
        row.original.nextFireAt ? new Date(row.original.nextFireAt).toLocaleString() : '—',
    },
    {
      accessorKey: 'lastRunStartedAt',
      header: 'Last run',
      cell: ({ row }) =>
        row.original.lastRunStartedAt
          ? new Date(row.original.lastRunStartedAt).toLocaleString()
          : '—',
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
  ]
}

function JobsPage() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const filters = {
    ...(search.customer ? { customerSlug: search.customer } : {}),
    ...(search.status ? { status: search.status } : {}),
  }
  const { data: jobs } = useSuspenseQuery(allJobsQueryOptions(filters))
  const filtered = Boolean(search.customer || search.status)

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-start justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Jobs</h1>
          <p className="text-sm text-muted-foreground">
            Every Job across every Customer. Filter by Customer or status.
          </p>
        </div>
        <Button render={<Link to="/" />} variant="outline" size="sm">
          ← Dashboard
        </Button>
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
        {search.customer ? (
          <Button
            variant="ghost"
            size="xs"
            onClick={() => navigate({ search: (prev) => ({ ...prev, customer: undefined }) })}
          >
            Clear customer filter
          </Button>
        ) : null}
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
            description="Create a Job from a Customer hub or from the dashboard."
          />
        )
      ) : (
        <DataTable columns={columnsFor()} data={jobs} />
      )}
    </div>
  )
}
