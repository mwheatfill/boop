import { queryOptions, useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import type { ColumnDef } from '@tanstack/react-table'
import { ArrowRight, Bell, Pencil, Plus, SendHorizonal } from 'lucide-react'
import { toast } from 'sonner'
import { z } from 'zod'
import { ContentChrome } from '@/components/ContentChrome'
import { DataTable } from '@/components/DataTable'
import { EmptyState } from '@/components/EmptyState'
import { useShortcut } from '@/components/keyboard/use-shortcut'
import { PinButton } from '@/components/PinButton'
import { StatusBadge } from '@/components/StatusBadge'
import { Button } from '@/components/ui/button'
import { listAlertRulesQueryOptions } from '@/lib/alert-rules/query-options'
import { listChannelsQueryOptions } from '@/lib/channels/query-options'
import { getCustomerFn } from '@/lib/customers/server-fns'
import { listAllJobsFn } from '@/lib/jobs/server-fns'
import { useTrackRecentVisit } from '@/lib/recents/use-track-recent-visit'
import { listTargetsForCustomerFn } from '@/lib/targets/server-fns'
import type { JobSummary } from '@/shared/schemas/job'
import type { Target } from '@/shared/schemas/target'

const searchSchema = z.object({
  archived: z.boolean().optional(),
})

const customerQueryOptions = (slug: string) =>
  queryOptions({
    queryKey: ['customers', slug],
    queryFn: () => getCustomerFn({ data: { slug } }),
  })

const targetsQueryOptions = (customerSlug: string, includeArchived: boolean) =>
  queryOptions({
    queryKey: ['customers', customerSlug, 'targets', { includeArchived }],
    queryFn: () => listTargetsForCustomerFn({ data: { customerSlug, includeArchived } }),
  })

const jobsQueryOptions = (customerSlug: string) =>
  queryOptions({
    queryKey: ['customers', customerSlug, 'jobs'],
    queryFn: () => listAllJobsFn({ data: { customerSlug } }),
  })

function jobsColumns(customerSlug: string): ColumnDef<JobSummary>[] {
  return [
    {
      accessorKey: 'name',
      header: 'Name',
      cell: ({ row }) => (
        <Link
          to="/customers/$customerSlug/jobs/$jobSlug"
          params={{ customerSlug, jobSlug: row.original.slug }}
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

export const Route = createFileRoute('/_authenticated/customers/$customerSlug/')({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({ archived: Boolean(search.archived) }),
  loader: async ({ context, params, deps }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(customerQueryOptions(params.customerSlug)),
      context.queryClient.ensureQueryData(targetsQueryOptions(params.customerSlug, deps.archived)),
      context.queryClient.ensureQueryData(jobsQueryOptions(params.customerSlug)),
      context.queryClient.ensureQueryData(listChannelsQueryOptions(params.customerSlug, false)),
      context.queryClient.ensureQueryData(listAlertRulesQueryOptions(params.customerSlug, false)),
    ])
  },
  component: CustomerHubPage,
})

const targetColumns = (customerSlug: string, isAdmin: boolean): ColumnDef<Target>[] => [
  {
    accessorKey: 'name',
    header: 'Name',
    cell: ({ row }) =>
      isAdmin ? (
        <Link
          to="/customers/$customerSlug/targets/$targetSlug"
          params={{ customerSlug, targetSlug: row.original.slug }}
          className="font-medium text-foreground hover:underline"
        >
          {row.original.name}
        </Link>
      ) : (
        <span className="font-medium text-foreground">{row.original.name}</span>
      ),
  },
  { accessorKey: 'slug', header: 'Slug' },
  { accessorKey: 'method', header: 'Method' },
  { accessorKey: 'url', header: 'URL' },
  { accessorKey: 'reachability', header: 'Reachability' },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
  },
]

function CustomerHubPage() {
  const { customerSlug } = Route.useParams()
  const search = Route.useSearch()
  const archived = Boolean(search.archived)
  const navigate = Route.useNavigate()
  const { currentUser } = Route.useRouteContext()
  const isAdmin = currentUser.role === 'admin'
  const { data: customer } = useSuspenseQuery(customerQueryOptions(customerSlug))
  const { data: targets } = useSuspenseQuery(targetsQueryOptions(customerSlug, archived))
  const { data: jobs } = useSuspenseQuery(jobsQueryOptions(customerSlug))
  const { data: channels } = useSuspenseQuery(listChannelsQueryOptions(customerSlug, false))
  const { data: rules } = useSuspenseQuery(listAlertRulesQueryOptions(customerSlug, false))

  useTrackRecentVisit({
    id: `customer:${customer.slug}`,
    entity: 'customer',
    label: customer.name,
    slug: customer.slug,
  })

  useShortcut(
    'e',
    () => {
      if (!isAdmin) {
        toast.error('Admin only.')
        return
      }
      void navigate({ to: '/customers/$customerSlug/edit', params: { customerSlug } })
    },
    { description: 'Edit Customer', section: 'page' },
  )

  return (
    <div className="flex flex-col gap-8">
      <header className="flex items-start justify-between">
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Customer
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">{customer.name}</h1>
          <p className="text-sm text-muted-foreground">
            <span className="font-mono">{customer.slug}</span> · {customer.timezone}
            {customer.autotaskCompanyId ? ` · Autotask ${customer.autotaskCompanyId}` : null}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={customer.status} />
          <PinButton
            entity={{
              id: `customer:${customer.slug}`,
              kind: 'customer',
              label: customer.name,
              slug: customer.slug,
            }}
          />
          {isAdmin ? (
            <Button
              size="sm"
              variant="outline"
              render={<Link to="/customers/$customerSlug/edit" params={{ customerSlug }} />}
            >
              <Pencil aria-hidden /> Edit
            </Button>
          ) : null}
          <ContentChrome />
        </div>
      </header>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">Targets</h2>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate({ search: archived ? {} : { archived: true } })}
            >
              {archived ? 'Hide archived' : 'Show archived'}
            </Button>
            {isAdmin ? (
              <Button
                size="sm"
                render={
                  <Link to="/customers/$customerSlug/targets/new" params={{ customerSlug }} />
                }
              >
                <Plus aria-hidden /> New Target
              </Button>
            ) : null}
          </div>
        </div>
        {targets.length === 0 ? (
          <EmptyState
            title={archived ? 'No archived Targets.' : 'No Targets yet.'}
            description={
              archived
                ? 'Toggle off "Show archived" to see active Targets.'
                : 'Add a Target so this Customer has somewhere for Jobs to fire.'
            }
            action={
              !archived && isAdmin ? (
                <Button
                  render={
                    <Link to="/customers/$customerSlug/targets/new" params={{ customerSlug }} />
                  }
                >
                  <Plus aria-hidden /> New Target
                </Button>
              ) : undefined
            }
          />
        ) : (
          <DataTable columns={targetColumns(customerSlug, isAdmin)} data={targets} />
        )}
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">Jobs</h2>
          <Button
            size="sm"
            render={<Link to="/customers/$customerSlug/jobs/new" params={{ customerSlug }} />}
          >
            <Plus aria-hidden /> New Job
          </Button>
        </div>
        {jobs.length === 0 ? (
          <EmptyState
            title="No Jobs yet."
            description="Create one to schedule HTTP calls against this Customer's Targets."
            action={
              <Button
                render={<Link to="/customers/$customerSlug/jobs/new" params={{ customerSlug }} />}
              >
                <Plus aria-hidden /> New Job
              </Button>
            }
          />
        ) : (
          <DataTable columns={jobsColumns(customerSlug)} data={jobs} />
        )}
      </section>

      <section className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Link
          to="/customers/$customerSlug/channels"
          params={{ customerSlug }}
          className="group flex items-center justify-between rounded-md border border-border bg-muted/20 p-4 hover:border-primary/40"
        >
          <div className="flex items-center gap-3">
            <SendHorizonal className="size-5 text-muted-foreground" aria-hidden />
            <div className="flex flex-col">
              <span className="text-sm font-medium">Channels</span>
              <span className="text-xs text-muted-foreground">
                {channels.length === 0
                  ? 'No active channels yet'
                  : `${channels.length} active channel${channels.length === 1 ? '' : 's'}`}
              </span>
            </div>
          </div>
          <ArrowRight
            className="size-4 text-muted-foreground group-hover:text-primary"
            aria-hidden
          />
        </Link>
        <Link
          to="/customers/$customerSlug/alert-rules"
          params={{ customerSlug }}
          className="group flex items-center justify-between rounded-md border border-border bg-muted/20 p-4 hover:border-primary/40"
        >
          <div className="flex items-center gap-3">
            <Bell className="size-5 text-muted-foreground" aria-hidden />
            <div className="flex flex-col">
              <span className="text-sm font-medium">Alert Rules</span>
              <span className="text-xs text-muted-foreground">
                {rules.length === 0
                  ? 'No active rules yet'
                  : `${rules.length} active rule${rules.length === 1 ? '' : 's'}`}
              </span>
            </div>
          </div>
          <ArrowRight
            className="size-4 text-muted-foreground group-hover:text-primary"
            aria-hidden
          />
        </Link>
      </section>
    </div>
  )
}
