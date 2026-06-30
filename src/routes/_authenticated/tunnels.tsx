import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import type { ColumnDef } from '@tanstack/react-table'
import { Pencil, Plus, Waypoints } from 'lucide-react'
import { useState } from 'react'
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

function columnsFor(onEdit: ((tunnel: Tunnel) => void) | null): ColumnDef<Tunnel>[] {
  const cols: ColumnDef<Tunnel>[] = [
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
      meta: { label: 'Status', filterVariant: 'select' },
      cell: ({ row }) => <TunnelStateBadge state={row.original.state} />,
    },
  ]
  if (onEdit) {
    // Trailing row-action: hover/focus-revealed direct Edit, so editing is one
    // click without leaving the list (the row itself opens the detail page).
    cols.push({
      id: 'actions',
      enableHiding: false,
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex justify-end">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Edit ${row.original.name}`}
            className="opacity-0 transition-opacity focus-visible:opacity-100 group-hover/row:opacity-100"
            onClick={(e) => {
              e.stopPropagation()
              onEdit(row.original)
            }}
          >
            <Pencil aria-hidden />
          </Button>
        </div>
      ),
    })
  }
  return cols
}

function TunnelsPage() {
  const { currentUser } = Route.useRouteContext()
  const isAdmin = currentUser.role === 'admin'
  const navigate = Route.useNavigate()
  const [editing, setEditing] = useState<Tunnel | null>(null)
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
          columns={columnsFor(isAdmin ? setEditing : null)}
          data={tunnels}
          gridKey="tunnels"
          onRowClick={(tunnel) =>
            navigate({ to: '/tunnels/$tunnelSlug', params: { tunnelSlug: tunnel.slug } })
          }
        />
      )}

      {isAdmin ? (
        <TunnelSheet
          open={!!editing}
          onOpenChange={(open) => {
            if (!open) setEditing(null)
          }}
          {...(editing ? { tunnel: editing } : {})}
        />
      ) : null}
    </div>
  )
}
