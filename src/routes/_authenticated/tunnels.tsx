import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import type { ColumnDef } from '@tanstack/react-table'
import { Plus, Waypoints } from 'lucide-react'
import { DataTable } from '@/components/DataTable'
import { DateTime } from '@/components/DateTime'
import { EmptyState } from '@/components/EmptyState'
import { TunnelHealthBadge } from '@/components/tunnels/TunnelHealthBadge'
import { TunnelRowActions } from '@/components/tunnels/TunnelRowActions'
import { Button } from '@/components/ui/button'
import { tunnelsQueryOptions } from '@/lib/tunnels/query-options'
import type { Tunnel } from '@/shared/schemas/tunnel'

export const Route = createFileRoute('/_authenticated/tunnels')({
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(tunnelsQueryOptions)
  },
  component: TunnelsPage,
})

function tunnelColumns(isAdmin: boolean): ColumnDef<Tunnel>[] {
  return [
    {
      accessorKey: 'name',
      header: 'Name',
      cell: ({ row }) => <span className="font-medium text-foreground">{row.original.name}</span>,
    },
    {
      accessorKey: 'hostname',
      header: 'Hostname',
      cell: ({ row }) => <span className="font-mono text-xs">{row.original.hostname}</span>,
    },
    {
      accessorKey: 'health',
      header: 'Health',
      cell: ({ row }) => <TunnelHealthBadge health={row.original.health} />,
    },
    {
      accessorKey: 'connectorStatus',
      header: 'Connector',
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">
          {row.original.connectorStatus ?? 'Pending'}
        </span>
      ),
    },
    {
      accessorKey: 'lastVerifiedAt',
      header: 'Last verified',
      cell: ({ row }) => <DateTime value={row.original.lastVerifiedAt} fallback="Never" />,
    },
    {
      id: 'actions',
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => <TunnelRowActions tunnel={row.original} isAdmin={isAdmin} />,
    },
  ]
}

function TunnelsPage() {
  const { currentUser } = Route.useRouteContext()
  const isAdmin = currentUser.role === 'admin'
  const { data: tunnels } = useSuspenseQuery(tunnelsQueryOptions)

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-start justify-between">
        <div className="flex flex-col gap-1">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Private Tunnels
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">Reach private-network origins</h1>
          <p className="text-sm text-muted-foreground">
            Cloudflare Tunnels that let Jobs reach internal services without a public IP.
          </p>
        </div>
        {isAdmin ? (
          <Button size="sm" render={<Link to="/tunnels/new" />}>
            <Plus aria-hidden /> New tunnel
          </Button>
        ) : null}
      </header>

      {tunnels.length === 0 ? (
        <EmptyState
          icon={Waypoints}
          title="No tunnels yet."
          description="Create a tunnel to reach a private origin, then install one command on the customer's network."
          action={
            isAdmin ? (
              <Button render={<Link to="/tunnels/new" />}>
                <Plus aria-hidden /> New tunnel
              </Button>
            ) : undefined
          }
        />
      ) : (
        <DataTable columns={tunnelColumns(isAdmin)} data={tunnels} />
      )}
    </div>
  )
}
