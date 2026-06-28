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

  const save = useMutation({
    mutationFn: () => updateTunnelFn({ data: { tunnelId: tunnel.id, name: name.trim() } }),
    onSuccess: async () => {
      toast.success('Saved')
      await queryClient.invalidateQueries({ queryKey: ['tunnels'] })
      onClose()
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Save failed'),
  })

  const dirty = name !== tunnel.name

  return (
    <EntityModal
      open
      onClose={onClose}
      title={`Edit ${tunnel.name}`}
      description="The name is a label. Internal origins live on each Private Target; the slug and hostname are fixed."
      dirty={dirty}
      primaryAction={{
        label: 'Save changes',
        onClick: () => save.mutate(),
        loading: save.isPending,
        disabled: name.trim().length === 0 || !dirty,
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
          Hostname <code className="font-mono text-foreground">{tunnel.hostname}</code> can't
          change.
        </p>
      </div>
    </EntityModal>
  )
}
