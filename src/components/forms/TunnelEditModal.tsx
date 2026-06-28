import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'
import { EntityModal } from '@/components/forms/EntityModal'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { updateTunnelFn } from '@/lib/tunnels/server-fns'
import type { Tunnel } from '@/shared/schemas/tunnel'

export function TunnelEditModal({ tunnel, onClose }: { tunnel: Tunnel; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [name, setName] = useState(tunnel.name)
  const [internalOrigin, setInternalOrigin] = useState(tunnel.internalOrigin)

  const save = useMutation({
    mutationFn: () =>
      updateTunnelFn({
        data: { tunnelId: tunnel.id, name: name.trim(), internalOrigin: internalOrigin.trim() },
      }),
    onSuccess: async () => {
      toast.success('Saved')
      await queryClient.invalidateQueries({ queryKey: ['tunnels'] })
      onClose()
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Save failed'),
  })

  const dirty = name !== tunnel.name || internalOrigin !== tunnel.internalOrigin
  const canSubmit = name.trim().length > 0 && internalOrigin.trim().length > 0 && dirty

  return (
    <EntityModal
      open
      onClose={onClose}
      title={`Edit ${tunnel.name}`}
      description="Renaming is a label change. Changing the internal origin re-points the connector on Cloudflare."
      dirty={dirty}
      primaryAction={{
        label: 'Save changes',
        onClick: () => save.mutate(),
        loading: save.isPending,
        disabled: !canSubmit,
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
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="tunnel-origin">Internal origin</Label>
        <Input
          id="tunnel-origin"
          value={internalOrigin}
          onChange={(e) => setInternalOrigin(e.currentTarget.value)}
          placeholder="http://10.0.1.50:8080"
          className="font-mono text-sm"
        />
        <p className="text-xs text-muted-foreground">
          The private address the tunnel forwards to. Hostname{' '}
          <code className="font-mono text-foreground">{tunnel.hostname}</code> can't change.
        </p>
      </div>
    </EntityModal>
  )
}
