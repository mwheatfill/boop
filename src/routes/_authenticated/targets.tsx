import { queryOptions, useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import type { ColumnDef } from '@tanstack/react-table'
import { Plus, Target as TargetIcon } from 'lucide-react'
import { useState } from 'react'
import { z } from 'zod'
import { DataTable } from '@/components/DataTable'
import { EmptyState } from '@/components/EmptyState'
import { TargetSheet } from '@/components/forms/TargetSheet'
import { StatusBadge } from '@/components/StatusBadge'
import { TargetHealthBadge } from '@/components/targets/TargetHealthBadge'
import { Button } from '@/components/ui/button'
import { listTargetsForWorkspaceFn } from '@/lib/targets/server-fns'
import { defaultWorkspaceQueryOptions } from '@/lib/workspaces/query-options'
import type { Target } from '@/shared/schemas/target'

const targetsQueryOptions = (workspaceSlug: string, includeArchived: boolean) =>
  queryOptions({
    queryKey: ['workspaces', workspaceSlug, 'targets', { includeArchived }],
    queryFn: () => listTargetsForWorkspaceFn({ data: { workspaceSlug, includeArchived } }),
  })

export const Route = createFileRoute('/_authenticated/targets')({
  loader: async ({ context }) => {
    const workspace = await context.queryClient.ensureQueryData(defaultWorkspaceQueryOptions)
    await context.queryClient.ensureQueryData(targetsQueryOptions(workspace.slug, false))
    return { activeSlug: workspace.slug }
  },
  component: TargetsPage,
})

const targetColumns: ColumnDef<Target>[] = [
  {
    accessorKey: 'name',
    header: 'Name',
    cell: ({ row }) => <span className="font-medium text-foreground">{row.original.name}</span>,
  },
  { accessorKey: 'method', header: 'Method', meta: { label: 'Method', filterVariant: 'select' } },
  {
    accessorKey: 'url',
    header: 'Address',
    cell: ({ row }) => (
      <span className="font-mono text-xs">
        {row.original.reachability === 'tunnel'
          ? (row.original.internalOrigin ?? row.original.url)
          : row.original.url}
      </span>
    ),
  },
  {
    accessorKey: 'reachability',
    header: 'Access',
    meta: { label: 'Access', filterVariant: 'select' },
  },
  {
    accessorKey: 'health',
    header: 'Health',
    cell: ({ row }) =>
      row.original.health ? <TargetHealthBadge health={row.original.health} /> : null,
  },
  {
    accessorKey: 'status',
    header: 'Status',
    meta: { label: 'Status', filterVariant: 'select' },
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
  },
]

function TargetsPage() {
  const { activeSlug } = Route.useLoaderData()
  if (!activeSlug) {
    return (
      <EmptyState
        icon={TargetIcon}
        title="No Workspaces yet."
        description="Create a Workspace before adding Targets."
      />
    )
  }
  return <TargetsList activeSlug={activeSlug} />
}

function TargetsList({ activeSlug }: { activeSlug: string }) {
  const { currentUser } = Route.useRouteContext()
  const isAdmin = currentUser.role === 'admin'
  const { data: targets } = useSuspenseQuery(targetsQueryOptions(activeSlug, false))
  const [editing, setEditing] = useState<Target | null>(null)

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-start justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Targets</h1>
          <p className="text-sm text-muted-foreground">The URLs your Jobs call.</p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin ? (
            <TargetSheet
              owner={{ workspaceSlug: activeSlug }}
              trigger={
                <Button size="sm">
                  <Plus aria-hidden /> New Target
                </Button>
              }
            />
          ) : null}
        </div>
      </header>

      {targets.length === 0 ? (
        <EmptyState
          icon={TargetIcon}
          title="No Targets yet."
          description="Add a Target so Jobs have somewhere to call."
          action={
            isAdmin ? (
              <TargetSheet
                owner={{ workspaceSlug: activeSlug }}
                trigger={
                  <Button>
                    <Plus aria-hidden /> New Target
                  </Button>
                }
              />
            ) : undefined
          }
        />
      ) : (
        <DataTable
          columns={targetColumns}
          data={targets}
          gridKey="targets"
          {...(isAdmin ? { onRowClick: (target: Target) => setEditing(target) } : {})}
        />
      )}

      {isAdmin ? (
        <TargetSheet
          owner={{ workspaceSlug: activeSlug }}
          open={!!editing}
          onOpenChange={(next) => {
            if (!next) setEditing(null)
          }}
          {...(editing ? { target: editing } : {})}
        />
      ) : null}
    </div>
  )
}
