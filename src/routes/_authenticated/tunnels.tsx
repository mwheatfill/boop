import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import type { ColumnDef } from '@tanstack/react-table'
import { Plus, Waypoints } from 'lucide-react'
import { DataTable } from '@/components/DataTable'
import { EmptyState } from '@/components/EmptyState'
import { TunnelSheet } from '@/components/forms/TunnelSheet'
import { TunnelStateBadge } from '@/components/tunnels/TunnelStateBadge'
import { Button } from '@/components/ui/button'
import { tunnelsQueryOptions } from '@/lib/tunnels/query-options'
import type { Tunnel } from '@/shared/schemas/tunnel'

export const Route = createFileRoute('/_authenticated/tunnels')({
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(tunnelsQueryOptions)
  },
  component: TunnelsPage,
})

const columns: ColumnDef<Tunnel>[] = [
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
    accessorKey: 'state',
    header: 'Status',
    cell: ({ row }) => <TunnelStateBadge state={row.original.state} />,
  },
]

function TunnelsPage() {
  const { currentUser } = Route.useRouteContext()
  const isAdmin = currentUser.role === 'admin'
  const navigate = Route.useNavigate()
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
          <TunnelSheet
            trigger={
              <Button size="sm">
                <Plus aria-hidden /> New tunnel
              </Button>
            }
          />
        ) : null}
      </header>

      {tunnels.length === 0 ? (
        <EmptyState
          icon={Waypoints}
          title="No tunnels yet."
          description="Create a tunnel to reach a private origin, then install one command on the customer's network."
          action={
            isAdmin ? (
              <TunnelSheet
                trigger={
                  <Button>
                    <Plus aria-hidden /> New tunnel
                  </Button>
                }
              />
            ) : undefined
          }
        />
      ) : (
        <DataTable
          columns={columns}
          data={tunnels}
          gridKey="tunnels"
          onRowClick={(tunnel) =>
            navigate({ to: '/tunnels/$tunnelSlug', params: { tunnelSlug: tunnel.slug } })
          }
        />
      )}
    </div>
  )
}
