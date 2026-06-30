import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { Plus, Waypoints } from 'lucide-react'
import { useState } from 'react'
import { DateTime } from '@/components/DateTime'
import { EmptyState } from '@/components/EmptyState'
import { TargetSheet } from '@/components/forms/TargetSheet'
import { TunnelSheet } from '@/components/forms/TunnelSheet'
import { TargetHealthBadge } from '@/components/targets/TargetHealthBadge'
import { TargetVerifyButton } from '@/components/targets/TargetVerifyButton'
import { TunnelActions } from '@/components/tunnels/TunnelActions'
import { TunnelStateBadge } from '@/components/tunnels/TunnelStateBadge'
import { Button } from '@/components/ui/button'
import { targetsForTunnelQueryOptions } from '@/lib/targets/query-options'
import { tunnelQueryOptions } from '@/lib/tunnels/query-options'

const CONNECTOR_LABEL: Record<string, string> = {
  healthy: 'Healthy',
  degraded: 'Degraded',
  down: 'Down',
  inactive: 'Not connected',
}
const CERT_LABEL: Record<string, string> = {
  active: 'Active',
  pending: 'Issuing',
  error: 'Error',
}
const VERIFY_LABEL: Record<string, string> = {
  ok: 'Connected',
  unauthorized: 'Unauthorized',
  forbidden: 'Forbidden',
  network: 'Unreachable',
  unknown: 'Inconclusive',
}

export const Route = createFileRoute('/_authenticated/tunnels_/$tunnelSlug')({
  loader: async ({ context, params }) => {
    const tunnel = await context.queryClient.ensureQueryData(tunnelQueryOptions(params.tunnelSlug))
    await context.queryClient.ensureQueryData(targetsForTunnelQueryOptions(tunnel.id))
  },
  component: TunnelDetailPage,
})

function TunnelDetailPage() {
  const { tunnelSlug } = Route.useParams()
  const { currentUser, workspaceSlug } = Route.useRouteContext()
  const isAdmin = currentUser.role === 'admin'
  const navigate = useNavigate()
  const [editing, setEditing] = useState(false)
  const { data: tunnel } = useSuspenseQuery(tunnelQueryOptions(tunnelSlug))
  const { data: ridingTargets } = useSuspenseQuery(targetsForTunnelQueryOptions(tunnel.id))

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">
          <Link to="/tunnels" className="hover:underline">
            Private Tunnels
          </Link>
        </p>
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold tracking-tight">{tunnel.name}</h1>
            <p className="text-sm text-muted-foreground font-mono">{tunnel.hostname}</p>
          </div>
          <div className="flex items-center gap-2">
            <TunnelStateBadge state={tunnel.state} />
            <TunnelActions
              tunnel={tunnel}
              isAdmin={isAdmin}
              targetCount={ridingTargets.length}
              onEdit={() => setEditing(true)}
              onRemoved={() => navigate({ to: '/tunnels' })}
            />
          </div>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-1">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Connection</p>
          <p className="text-sm">
            {tunnel.connectorStatus ? CONNECTOR_LABEL[tunnel.connectorStatus] : 'Not connected'}
          </p>
          <p className="text-xs text-muted-foreground">
            <DateTime value={tunnel.connectorCheckedAt} fallback="Not checked yet" />
          </p>
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Certificate</p>
          <p className="text-sm">
            {tunnel.certStatus ? CERT_LABEL[tunnel.certStatus] : 'Not issued'}
          </p>
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Last checked</p>
          <p className="text-sm">
            {tunnel.lastVerifyOutcome ? VERIFY_LABEL[tunnel.lastVerifyOutcome] : 'Never'}
          </p>
          <p className="text-xs text-muted-foreground">
            <DateTime value={tunnel.lastVerifiedAt} fallback="Never" />
          </p>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-medium">Targets</h2>
            <p className="text-sm text-muted-foreground">
              Targets that use this tunnel, with their current health.
            </p>
          </div>
          {isAdmin && ridingTargets.length > 0 ? (
            <TargetSheet
              owner={{ workspaceSlug }}
              trigger={
                <Button size="sm">
                  <Plus aria-hidden /> Add target
                </Button>
              }
            />
          ) : null}
        </div>
        {ridingTargets.length === 0 ? (
          <EmptyState
            icon={Waypoints}
            title="No targets use this tunnel yet."
            description="Add a target and choose this tunnel."
            action={
              isAdmin ? (
                <TargetSheet
                  owner={{ workspaceSlug }}
                  trigger={
                    <Button>
                      <Plus aria-hidden /> Add target
                    </Button>
                  }
                />
              ) : undefined
            }
          />
        ) : (
          <ul className="divide-y divide-border border-y border-border">
            {ridingTargets.map((target) => (
              <li key={target.id} className="flex items-center justify-between gap-3 py-3">
                <div className="flex flex-col gap-0.5">
                  {isAdmin ? (
                    <Link to="/targets" className="font-medium text-foreground hover:underline">
                      {target.name}
                    </Link>
                  ) : (
                    <span className="font-medium text-foreground">{target.name}</span>
                  )}
                  <span className="font-mono text-xs text-muted-foreground">
                    {target.internalOrigin ?? target.url}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  {target.health ? <TargetHealthBadge health={target.health} /> : null}
                  <TargetVerifyButton targetId={target.id} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {isAdmin ? <TunnelSheet tunnel={tunnel} open={editing} onOpenChange={setEditing} /> : null}
    </div>
  )
}
