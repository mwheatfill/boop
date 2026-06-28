import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CircleCheck, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { EntityModal } from '@/components/forms/EntityModal'
import { TunnelInstallCommands } from '@/components/tunnels/TunnelInstallCommands'
import { TunnelStateBadge } from '@/components/tunnels/TunnelStateBadge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { slugify } from '@/lib/slug/slugify'
import { tunnelQueryOptions } from '@/lib/tunnels/query-options'
import { provisionTunnelFn } from '@/lib/tunnels/server-fns'

interface Provisioned {
  hostname: string
  installToken: string
}

export function TunnelModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [result, setResult] = useState<Provisioned | null>(null)

  const provision = useMutation({
    mutationFn: () => provisionTunnelFn({ data: { name: name.trim(), slug: slugify(name) } }),
    onSuccess: (r) => {
      setResult({ hostname: r.hostname, installToken: r.installToken })
      void queryClient.invalidateQueries({ queryKey: ['tunnels'] })
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Provisioning failed'),
  })

  // After provisioning, poll the tunnel so the operator sees it flip to
  // Operational on its own once the connector connects (no manual refresh).
  const { data: live } = useQuery({
    ...tunnelQueryOptions(slugify(name)),
    enabled: result !== null,
    refetchInterval: (q) => (q.state.data?.state === 'operational' ? false : 4000),
  })

  if (result) {
    const operational = live?.state === 'operational'
    return (
      <EntityModal
        open
        onClose={onClose}
        size="wide"
        title="Install the connector"
        description="Run one of these on a host inside the private network. This flips to Operational on its own once the connector connects."
        primaryAction={{ label: operational ? 'Done' : 'Close', onClick: onClose }}
      >
        <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
          {operational ? (
            <>
              <CircleCheck data-icon="inline-start" className="size-4 text-success" aria-hidden />
              <span className="text-foreground">Connected. The tunnel is operational.</span>
            </>
          ) : (
            <>
              <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden />
              <span className="text-muted-foreground">
                Waiting for the connector to come online…
              </span>
              {live ? <TunnelStateBadge state={live.state} /> : null}
            </>
          )}
        </div>
        <TunnelInstallCommands hostname={result.hostname} installToken={result.installToken} />
      </EntityModal>
    )
  }

  return (
    <EntityModal
      open
      onClose={onClose}
      title="New tunnel"
      description="One connector per site. Install it once; then point Private Targets at this tunnel and boop wires each route."
      dirty={name.length > 0}
      primaryAction={{
        label: 'Create tunnel',
        onClick: () => provision.mutate(),
        loading: provision.isPending,
        disabled: name.trim().length === 0,
      }}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="tunnel-name">Name</Label>
        <Input
          id="tunnel-name"
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
          placeholder="Acme HQ"
        />
        <p className="text-xs text-muted-foreground">
          A site or network, not a single service. Internal addresses are set per Target.
        </p>
      </div>
    </EntityModal>
  )
}
