import { queryOptions, useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import type { ColumnDef } from '@tanstack/react-table'
import { Plus } from 'lucide-react'
import { z } from 'zod'
import { DataTable } from '@/components/DataTable'
import { EmptyState } from '@/components/EmptyState'
import { StatusBadge } from '@/components/StatusBadge'
import { Button } from '@/components/ui/button'
import { listCustomersFn } from '@/lib/customers/server-fns'
import type { Customer } from '@/shared/schemas/customer'

const searchSchema = z.object({
  archived: z.boolean().optional(),
})

const customersQueryOptions = (includeArchived: boolean) =>
  queryOptions({
    queryKey: ['customers', { includeArchived }],
    queryFn: () => listCustomersFn({ data: { includeArchived } }),
  })

export const Route = createFileRoute('/_authenticated/customers/')({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({ archived: Boolean(search.archived) }),
  loader: ({ context, deps }) =>
    context.queryClient.ensureQueryData(customersQueryOptions(deps.archived)),
  component: CustomersListPage,
})

const columns: ColumnDef<Customer>[] = [
  {
    accessorKey: 'name',
    header: 'Name',
    cell: ({ row }) => (
      <Link
        to="/customers/$customerSlug"
        params={{ customerSlug: row.original.slug }}
        className="font-medium text-foreground hover:underline"
      >
        {row.original.name}
      </Link>
    ),
  },
  { accessorKey: 'slug', header: 'Slug' },
  { accessorKey: 'timezone', header: 'Timezone' },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
  },
]

function CustomersListPage() {
  const search = Route.useSearch()
  const archived = Boolean(search.archived)
  const navigate = Route.useNavigate()
  const { data: customers } = useSuspenseQuery(customersQueryOptions(archived))
  const { currentUser } = Route.useRouteContext()
  const isAdmin = currentUser.role === 'admin'

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Customers</h1>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate({ search: archived ? {} : { archived: true } })}
          >
            {archived ? 'Hide archived' : 'Show archived'}
          </Button>
          {isAdmin ? (
            <Button render={<Link to="/customers/new" />} size="sm">
              <Plus aria-hidden /> New Customer
            </Button>
          ) : null}
        </div>
      </div>
      {customers.length === 0 ? (
        <EmptyState
          title={archived ? 'No archived Customers.' : 'No Customers yet.'}
          description={
            archived
              ? 'Toggle off "Show archived" to see active Customers.'
              : 'Welcome to boop. Create your first Customer to get started.'
          }
          action={
            !archived && isAdmin ? (
              <Button render={<Link to="/customers/new" />}>
                <Plus aria-hidden /> New Customer
              </Button>
            ) : undefined
          }
        />
      ) : (
        <DataTable columns={columns} data={customers} />
      )}
    </div>
  )
}
