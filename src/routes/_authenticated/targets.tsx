import { queryOptions, useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import type { ColumnDef } from '@tanstack/react-table'
import { Plus, Target as TargetIcon } from 'lucide-react'
import { z } from 'zod'
import { DataTable } from '@/components/DataTable'
import { EmptyState } from '@/components/EmptyState'
import { StatusBadge } from '@/components/StatusBadge'
import { TargetHealthBadge } from '@/components/targets/TargetHealthBadge'
import { Button } from '@/components/ui/button'
import { listTargetsForWorkspaceFn } from '@/lib/targets/server-fns'
import { defaultWorkspaceQueryOptions } from '@/lib/workspaces/query-options'
import type { Target } from '@/shared/schemas/target'

const searchSchema = z.object({
  archived: z.boolean().optional(),
})

const targetsQueryOptions = (workspaceSlug: string, includeArchived: boolean) =>
  queryOptions({
    queryKey: ['workspaces', workspaceSlug, 'targets', { includeArchived }],
    queryFn: () => listTargetsForWorkspaceFn({ data: { workspaceSlug, includeArchived } }),
  })

export const Route = createFileRoute('/_authenticated/targets')({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({ archived: Boolean(search.archived) }),
  loader: async ({ context, deps }) => {
    const workspace = await context.queryClient.ensureQueryData(defaultWorkspaceQueryOptions)
    await context.queryClient.ensureQueryData(targetsQueryOptions(workspace.slug, deps.archived))
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
  { accessorKey: 'slug', header: 'Slug' },
  { accessorKey: 'method', header: 'Method' },
  { accessorKey: 'url', header: 'URL' },
  { accessorKey: 'reachability', header: 'Reachability' },
  {
    accessorKey: 'health',
    header: 'Health',
    cell: ({ row }) =>
      row.original.health ? (
        <TargetHealthBadge health={row.original.health} />
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
  },
  {
    accessorKey: 'status',
    header: 'Status',
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
  const search = Route.useSearch()
  const archived = Boolean(search.archived)
  const navigate = Route.useNavigate()
  const { currentUser } = Route.useRouteContext()
  const isAdmin = currentUser.role === 'admin'
  const { data: targets } = useSuspenseQuery(targetsQueryOptions(activeSlug, archived))

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-start justify-between">
        <div className="flex flex-col gap-1">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Targets
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">Reusable HTTP destinations</h1>
          <p className="text-sm text-muted-foreground">
            URL, method, and auth that Jobs in this Workspace fire against.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate({ search: (prev) => ({ ...prev, archived: !archived }) })}
          >
            {archived ? 'Hide archived' : 'Show archived'}
          </Button>
          {isAdmin ? (
            <Button size="sm" render={<Link to="/targets/new" />}>
              <Plus aria-hidden /> New Target
            </Button>
          ) : null}
        </div>
      </header>

      {targets.length === 0 ? (
        <EmptyState
          icon={TargetIcon}
          title={archived ? 'No archived Targets.' : 'No Targets yet.'}
          description={
            archived
              ? 'Toggle off "Show archived" to see active Targets.'
              : 'Add a Target so Jobs have somewhere to fire.'
          }
          action={
            !archived && isAdmin ? (
              <Button render={<Link to="/targets/new" />}>
                <Plus aria-hidden /> New Target
              </Button>
            ) : undefined
          }
        />
      ) : (
        <DataTable
          columns={targetColumns}
          data={targets}
          {...(isAdmin
            ? {
                onRowClick: (target: Target) => {
                  void navigate({
                    to: '/targets/$targetSlug',
                    params: { targetSlug: target.slug },
                  })
                },
              }
            : {})}
        />
      )}
    </div>
  )
}
