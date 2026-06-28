import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'
import { EntityModal } from '@/components/forms/EntityModal'
import { TunnelInstallCommands } from '@/components/tunnels/TunnelInstallCommands'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { slugify } from '@/lib/slug/slugify'
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

  if (result) {
    return (
      <EntityModal
        open
        onClose={onClose}
        size="wide"
        title="Install the connector"
        description="Run one of these on a host inside the private network. The tunnel comes online within a minute, then shows as Operational."
        primaryAction={{ label: 'Done', onClick: onClose }}
      >
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
