import { queryOptions, useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import type { ColumnDef } from '@tanstack/react-table'
import { Pencil, Plus } from 'lucide-react'
import { z } from 'zod'
import { DataTable } from '@/components/DataTable'
import { EmptyState } from '@/components/EmptyState'
import { StatusBadge } from '@/components/StatusBadge'
import { Button } from '@/components/ui/button'
import { getCustomerFn } from '@/lib/customers/server-fns'
import { listTargetsForCustomerFn } from '@/lib/targets/server-fns'
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

export const Route = createFileRoute('/_authenticated/customers/$customerSlug/')({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({ archived: Boolean(search.archived) }),
  loader: async ({ context, params, deps }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(customerQueryOptions(params.customerSlug)),
      context.queryClient.ensureQueryData(targetsQueryOptions(params.customerSlug, deps.archived)),
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
          {isAdmin ? (
            <Button
              size="sm"
              variant="outline"
              render={<Link to="/customers/$customerSlug/edit" params={{ customerSlug }} />}
            >
              <Pencil aria-hidden /> Edit
            </Button>
          ) : null}
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
    </div>
  )
}
