import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, Link, Outlet } from '@tanstack/react-router'
import type { ColumnDef } from '@tanstack/react-table'
import { Plus, SendHorizonal } from 'lucide-react'
import { z } from 'zod'
import { DataTable } from '@/components/DataTable'
import { EmptyState } from '@/components/EmptyState'
import { StatusBadge } from '@/components/StatusBadge'
import { Button } from '@/components/ui/button'
import { workspaceChannelsQueryOptions } from '@/lib/channels/query-options'
import type { Channel } from '@/shared/schemas/channel'

const searchSchema = z.object({ archived: z.boolean().optional() })

export const Route = createFileRoute('/_authenticated/_admin/channels')({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({ archived: Boolean(search.archived) }),
  loader: async ({ context, deps }) => {
    await context.queryClient.ensureQueryData(workspaceChannelsQueryOptions(deps.archived))
  },
  component: WorkspaceChannelsPage,
})

function workspaceChannelColumns(): ColumnDef<Channel>[] {
  return [
    {
      accessorKey: 'name',
      header: 'Name',
      cell: ({ row }) => (
        <Link
          to="/channels/$channelSlug"
          params={{ channelSlug: row.original.slug }}
          className="font-medium text-foreground hover:underline"
        >
          {row.original.name}
        </Link>
      ),
    },
    { accessorKey: 'slug', header: 'Slug' },
    { accessorKey: 'kind', header: 'Kind' },
    {
      accessorKey: 'lastUsedAt',
      header: 'Last used',
      cell: ({ row }) =>
        row.original.lastUsedAt ? new Date(row.original.lastUsedAt).toLocaleString() : '—',
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
  ]
}

function WorkspaceChannelsPage() {
  const search = Route.useSearch()
  const archived = Boolean(search.archived)
  const navigate = Route.useNavigate()
  const { data: channels } = useSuspenseQuery(workspaceChannelsQueryOptions(archived))

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-start justify-between">
        <div className="flex flex-col gap-1">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Channels
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">Workspace destinations</h1>
          <p className="text-sm text-muted-foreground">
            Share one Teams, Email, or Webhook destination across every Customer.
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
          <Button size="sm" render={<Link to="/channels/new" />}>
            <Plus aria-hidden /> New Channel
          </Button>
        </div>
      </header>

      {channels.length === 0 ? (
        <EmptyState
          icon={SendHorizonal}
          title={archived ? 'No archived workspace Channels.' : 'No workspace Channels yet.'}
          description={
            archived
              ? 'Toggle off "Show archived" to see active Channels.'
              : 'Create one to share across every Customer.'
          }
          action={
            !archived ? (
              <Button render={<Link to="/channels/new" />}>
                <Plus aria-hidden /> New Channel
              </Button>
            ) : undefined
          }
        />
      ) : (
        <DataTable columns={workspaceChannelColumns()} data={channels} />
      )}
      <Outlet />
    </div>
  )
}
