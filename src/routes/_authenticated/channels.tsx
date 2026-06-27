import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import type { ColumnDef } from '@tanstack/react-table'
import { Plus, SendHorizonal } from 'lucide-react'
import { z } from 'zod'
import { DataTable } from '@/components/DataTable'
import { DateTime } from '@/components/DateTime'
import { EmptyState } from '@/components/EmptyState'
import { StatusBadge } from '@/components/StatusBadge'
import { Button } from '@/components/ui/button'
import { listChannelsQueryOptions } from '@/lib/channels/query-options'
import { defaultWorkspaceQueryOptions } from '@/lib/workspaces/query-options'
import type { Channel } from '@/shared/schemas/channel'

const searchSchema = z.object({
  archived: z.boolean().optional(),
})

export const Route = createFileRoute('/_authenticated/channels')({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({ archived: Boolean(search.archived) }),
  loader: async ({ context, deps }) => {
    const workspace = await context.queryClient.ensureQueryData(defaultWorkspaceQueryOptions)
    await context.queryClient.ensureQueryData(
      listChannelsQueryOptions(workspace.slug, deps.archived),
    )
    return { activeSlug: workspace.slug }
  },
  component: ChannelsPage,
})

function channelColumns(isAdmin: boolean): ColumnDef<Channel>[] {
  return [
    {
      accessorKey: 'name',
      header: 'Name',
      cell: ({ row }) =>
        isAdmin ? (
          <Link
            to="/channels/$channelSlug"
            params={{ channelSlug: row.original.slug }}
            className="font-medium text-foreground hover:underline"
          >
            {row.original.name}
          </Link>
        ) : (
          <span className="font-medium text-foreground">{row.original.name}</span>
        ),
    },
    { accessorKey: 'slug', header: 'Slug' },
    { accessorKey: 'kind', header: 'Kind' },
    {
      accessorKey: 'lastUsedAt',
      header: 'Last used',
      cell: ({ row }) => <DateTime value={row.original.lastUsedAt} fallback="Never" />,
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
  ]
}

function ChannelsPage() {
  const { activeSlug } = Route.useLoaderData()
  if (!activeSlug) {
    return (
      <EmptyState
        icon={SendHorizonal}
        title="No Workspaces yet."
        description="Create a Workspace before configuring Channels."
      />
    )
  }
  return <ChannelsList activeSlug={activeSlug} />
}

function ChannelsList({ activeSlug }: { activeSlug: string }) {
  const search = Route.useSearch()
  const archived = Boolean(search.archived)
  const navigate = Route.useNavigate()
  const { currentUser } = Route.useRouteContext()
  const isAdmin = currentUser.role === 'admin'
  const { data: channels } = useSuspenseQuery(listChannelsQueryOptions(activeSlug, archived))

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-start justify-between">
        <div className="flex flex-col gap-1">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Channels
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">Outbound destinations</h1>
          <p className="text-sm text-muted-foreground">
            Configure Teams, Email, and Webhook destinations for alerts.
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
            <Button size="sm" render={<Link to="/channels/new" />}>
              <Plus aria-hidden /> New Channel
            </Button>
          ) : null}
        </div>
      </header>

      {channels.length === 0 ? (
        <EmptyState
          icon={SendHorizonal}
          title={archived ? 'No archived Channels.' : 'No Channels yet.'}
          description={
            archived
              ? 'Toggle off "Show archived" to see active Channels.'
              : 'Create a Channel so alerts have somewhere to land.'
          }
          action={
            !archived && isAdmin ? (
              <Button render={<Link to="/channels/new" />}>
                <Plus aria-hidden /> New Channel
              </Button>
            ) : undefined
          }
        />
      ) : (
        <DataTable columns={channelColumns(isAdmin)} data={channels} />
      )}
    </div>
  )
}
