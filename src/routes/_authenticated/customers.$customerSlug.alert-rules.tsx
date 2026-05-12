import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, Link, Outlet } from '@tanstack/react-router'
import type { ColumnDef } from '@tanstack/react-table'
import { Bell, Plus } from 'lucide-react'
import { z } from 'zod'
import { DataTable } from '@/components/DataTable'
import { EmptyState } from '@/components/EmptyState'
import { StatusBadge } from '@/components/StatusBadge'
import { Button } from '@/components/ui/button'
import { listAlertRulesQueryOptions } from '@/lib/alert-rules/query-options'
import { listChannelsQueryOptions } from '@/lib/channels/query-options'
import { getCustomerFn } from '@/lib/customers/server-fns'
import { type AlertRule, summarizeRuleConfig } from '@/shared/schemas/alert-rule'

const searchSchema = z.object({ archived: z.boolean().optional() })

const customerQueryOptions = (slug: string) => ({
  queryKey: ['customers', slug] as const,
  queryFn: () => getCustomerFn({ data: { slug } }),
})

export const Route = createFileRoute('/_authenticated/customers/$customerSlug/alert-rules')({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({ archived: Boolean(search.archived) }),
  loader: async ({ context, params, deps }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(customerQueryOptions(params.customerSlug)),
      context.queryClient.ensureQueryData(
        listAlertRulesQueryOptions(params.customerSlug, deps.archived),
      ),
      context.queryClient.ensureQueryData(listChannelsQueryOptions(params.customerSlug, true)),
    ])
  },
  component: AlertRulesPage,
})

function columnsFor(
  customerSlug: string,
  channelNameById: Map<string, string>,
): ColumnDef<AlertRule>[] {
  return [
    {
      accessorKey: 'name',
      header: 'Name',
      cell: ({ row }) => (
        <Link
          to="/customers/$customerSlug/alert-rules/$ruleSlug"
          params={{ customerSlug, ruleSlug: row.original.slug }}
          className="font-medium text-foreground hover:underline"
        >
          {row.original.name}
        </Link>
      ),
    },
    {
      accessorKey: 'kind',
      header: 'Predicate',
      cell: ({ row }) => summarizeRuleConfig(row.original.config),
    },
    {
      accessorKey: 'channelIds',
      header: 'Channels',
      cell: ({ row }) =>
        row.original.channelIds.map((id) => channelNameById.get(id) ?? id).join(', '),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
  ]
}

function AlertRulesPage() {
  const { customerSlug } = Route.useParams()
  const search = Route.useSearch()
  const archived = Boolean(search.archived)
  const navigate = Route.useNavigate()
  const { data: rules } = useSuspenseQuery(listAlertRulesQueryOptions(customerSlug, archived))
  const { data: channels } = useSuspenseQuery(listChannelsQueryOptions(customerSlug, true))
  const channelNameById = new Map(channels.map((c) => [c.id, c.name]))

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-start justify-between">
        <div className="flex flex-col gap-1">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Alert Rules
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">Customer-default routing</h1>
          <p className="text-sm text-muted-foreground">
            Predicates that decide which Channels fan out when a Run becomes terminal.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate({ search: archived ? {} : { archived: true } })}
          >
            {archived ? 'Hide archived' : 'Show archived'}
          </Button>
          <Button
            size="sm"
            render={
              <Link to="/customers/$customerSlug/alert-rules/new" params={{ customerSlug }} />
            }
          >
            <Plus aria-hidden /> New Alert Rule
          </Button>
        </div>
      </header>

      {rules.length === 0 ? (
        <EmptyState
          icon={Bell}
          title={archived ? 'No archived rules.' : 'No alert rules yet.'}
          description={
            archived
              ? 'Toggle off "Show archived" to see active rules.'
              : 'Wire a predicate to one or more Channels to start routing alerts.'
          }
          action={
            !archived ? (
              <Button
                render={
                  <Link to="/customers/$customerSlug/alert-rules/new" params={{ customerSlug }} />
                }
              >
                <Plus aria-hidden /> New Alert Rule
              </Button>
            ) : undefined
          }
        />
      ) : (
        <DataTable columns={columnsFor(customerSlug, channelNameById)} data={rules} />
      )}
      <Outlet />
    </div>
  )
}
