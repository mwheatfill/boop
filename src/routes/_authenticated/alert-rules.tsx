import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, Link, Outlet } from '@tanstack/react-router'
import type { ColumnDef } from '@tanstack/react-table'
import { Bell, Plus } from 'lucide-react'
import { DataTable } from '@/components/DataTable'
import { EmptyState } from '@/components/EmptyState'
import { AlertRuleSheet } from '@/components/forms/AlertRuleSheet'
import { StatusBadge } from '@/components/StatusBadge'
import { Button } from '@/components/ui/button'
import { listAlertRulesQueryOptions } from '@/lib/alert-rules/query-options'
import { listChannelsQueryOptions } from '@/lib/channels/query-options'
import { defaultWorkspaceQueryOptions } from '@/lib/workspaces/query-options'
import { type AlertRule, summarizeRuleConfig } from '@/shared/schemas/alert-rule'

export const Route = createFileRoute('/_authenticated/alert-rules')({
  loader: async ({ context }) => {
    const workspace = await context.queryClient.ensureQueryData(defaultWorkspaceQueryOptions)
    await Promise.all([
      context.queryClient.ensureQueryData(listAlertRulesQueryOptions(workspace.slug, false)),
      context.queryClient.ensureQueryData(listChannelsQueryOptions(workspace.slug, true)),
    ])
    return { activeSlug: workspace.slug }
  },
  component: AlertRulesPage,
})

function columnsFor(channelNameById: Map<string, string>): ColumnDef<AlertRule>[] {
  return [
    {
      accessorKey: 'name',
      header: 'Name',
      cell: ({ row }) => (
        <Link
          to="/alert-rules/$ruleSlug"
          params={{ ruleSlug: row.original.slug }}
          className="font-medium text-foreground hover:underline"
        >
          {row.original.name}
        </Link>
      ),
    },
    {
      accessorKey: 'kind',
      header: 'Condition',
      meta: { label: 'Condition', filterVariant: 'select' },
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
      meta: { label: 'Status', filterVariant: 'select' },
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
  ]
}

function AlertRulesPage() {
  const { activeSlug } = Route.useLoaderData()
  return (
    <>
      {activeSlug ? (
        <AlertRulesList activeSlug={activeSlug} />
      ) : (
        <EmptyState
          icon={Bell}
          title="No Workspaces yet."
          description="Create a Workspace before adding Alert Rules."
        />
      )}
      {/* $ruleSlug detail route renders here */}
      <Outlet />
    </>
  )
}

function AlertRulesList({ activeSlug }: { activeSlug: string }) {
  const { currentUser } = Route.useRouteContext()
  const isAdmin = currentUser.role === 'admin'
  const { data: rules } = useSuspenseQuery(listAlertRulesQueryOptions(activeSlug, false))
  const { data: channels } = useSuspenseQuery(listChannelsQueryOptions(activeSlug, true))
  const channelNameById = new Map(channels.map((c) => [c.id, c.name]))

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-start justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Alert rules</h1>
          <p className="text-sm text-muted-foreground">When to send alerts, and where.</p>
        </div>
        <div className="flex items-center gap-2">
          <AlertRuleSheet
            owner={{ workspaceSlug: activeSlug }}
            isAdmin={isAdmin}
            trigger={
              <Button size="sm">
                <Plus aria-hidden /> New Alert Rule
              </Button>
            }
          />
        </div>
      </header>

      {rules.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="No alert rules yet."
          description="Connect a condition to one or more Channels to start sending alerts."
          action={
            <AlertRuleSheet
              owner={{ workspaceSlug: activeSlug }}
              isAdmin={isAdmin}
              trigger={
                <Button>
                  <Plus aria-hidden /> New Alert Rule
                </Button>
              }
            />
          }
        />
      ) : (
        <DataTable columns={columnsFor(channelNameById)} data={rules} gridKey="alert-rules" />
      )}
    </div>
  )
}
