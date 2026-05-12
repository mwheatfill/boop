import { queryOptions, useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import type { ColumnDef } from '@tanstack/react-table'
import { Plus } from 'lucide-react'
import { useEffect } from 'react'
import { toast } from 'sonner'
import { z } from 'zod'
import { DataTable } from '@/components/DataTable'
import { EmptyState } from '@/components/EmptyState'
import { StatusBadge } from '@/components/StatusBadge'
import { Button } from '@/components/ui/button'
import { countCustomersFn } from '@/lib/customers/server-fns'
import { listAllJobsFn } from '@/lib/jobs/server-fns'
import type { JobSummary } from '@/shared/schemas/job'

const customerCountQueryOptions = queryOptions({
  queryKey: ['customers', 'count'],
  queryFn: () => countCustomersFn(),
})

const allJobsQueryOptions = (filters: {
  customerSlug?: string
  status?: 'active' | 'paused' | 'archived'
}) =>
  queryOptions({
    queryKey: ['jobs', filters],
    queryFn: () => listAllJobsFn({ data: filters }),
  })

const searchSchema = z.object({
  unauthorized: z.string().optional(),
  customer: z.string().optional(),
  status: z.enum(['active', 'paused', 'archived']).optional(),
})

export const Route = createFileRoute('/')({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({
    customerSlug: search.customer,
    status: search.status,
  }),
  loader: async ({ context, deps }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(customerCountQueryOptions),
      context.queryClient.ensureQueryData(
        allJobsQueryOptions({
          ...(deps.customerSlug ? { customerSlug: deps.customerSlug } : {}),
          ...(deps.status ? { status: deps.status } : {}),
        }),
      ),
    ])
  },
  component: HomePage,
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
    {
      accessorKey: 'triggerKind',
      header: 'Trigger',
      cell: ({ row }) => row.original.triggerKind,
    },
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

function HomePage() {
  const { data: customerCount } = useSuspenseQuery(customerCountQueryOptions)
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const filters = {
    ...(search.customer ? { customerSlug: search.customer } : {}),
    ...(search.status ? { status: search.status } : {}),
  }
  const { data: jobs } = useSuspenseQuery(allJobsQueryOptions(filters))

  useEffect(() => {
    if (search.unauthorized) {
      toast.error('You do not have access to that page.', {
        description: `${search.unauthorized} requires Admin access.`,
      })
    }
  }, [search.unauthorized])

  if (customerCount === 0) {
    return (
      <EmptyState
        title="Welcome to boop."
        description="Create your first Customer to get started."
        action={
          <Button render={<Link to="/customers/new" />}>
            <Plus aria-hidden /> New Customer
          </Button>
        }
      />
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Jobs</h1>
        <p className="text-sm text-muted-foreground">
          Every Job across every Customer. Filter by Customer or status.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant={search.status ? 'outline' : 'default'}
          size="xs"
          onClick={() => navigate({ search: { ...search, status: undefined } })}
        >
          All
        </Button>
        {STATUSES.map((status) => (
          <Button
            key={status}
            variant={search.status === status ? 'default' : 'outline'}
            size="xs"
            onClick={() => navigate({ search: { ...search, status } })}
          >
            {status}
          </Button>
        ))}
        {search.customer ? (
          <Button
            variant="ghost"
            size="xs"
            onClick={() => navigate({ search: { ...search, customer: undefined } })}
          >
            Clear customer filter
          </Button>
        ) : null}
      </div>

      {jobs.length === 0 ? (
        <EmptyState
          title="No Jobs match these filters."
          description="Create a Job from a Customer hub to start scheduling."
        />
      ) : (
        <DataTable columns={columnsFor()} data={jobs} />
      )}
    </div>
  )
}
