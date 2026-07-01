import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { tunnelsQueryOptions } from '@/lib/tunnels/query-options'
import { moveTargetsToTunnelFn } from '@/lib/tunnels/server-fns'
import type { Tunnel } from '@/shared/schemas/tunnel'

function plural(n: number) {
  return n === 1 ? 'Target' : 'Targets'
}

export function MoveTargetsDialog({
  tunnel,
  targetCount,
  open,
  onOpenChange,
}: {
  tunnel: Tunnel
  targetCount: number
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const { data: tunnels = [] } = useQuery(tunnelsQueryOptions)
  const [toTunnelId, setToTunnelId] = useState('')
  const others = tunnels.filter((t) => t.id !== tunnel.id)

  const move = useMutation({
    mutationFn: () => moveTargetsToTunnelFn({ data: { fromTunnelId: tunnel.id, toTunnelId } }),
    onSuccess: async (result) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['tunnels'] }),
        queryClient.invalidateQueries({ queryKey: ['workspaces'] }),
      ])
      toast.success(`Moved ${result.moved} ${plural(result.moved)}`)
      setToTunnelId('')
      onOpenChange(false)
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Move failed'),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Move Targets off {tunnel.name}</DialogTitle>
          <DialogDescription>
            Move its {targetCount} {plural(targetCount)} (and their Jobs) to another tunnel. Each
            Target's address changes to the new tunnel, so pick one that can reach the same origins.
          </DialogDescription>
        </DialogHeader>
        {others.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            There's no other tunnel to move them to. Create one first.
          </p>
        ) : (
          <Select value={toTunnelId} onValueChange={(v) => setToTunnelId(v ?? '')}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Move to tunnel" />
            </SelectTrigger>
            <SelectContent>
              {others.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!toTunnelId || move.isPending}
            onClick={() => move.mutate()}
          >
            {move.isPending ? (
              <>
                <Spinner /> Moving
              </>
            ) : (
              `Move ${targetCount} ${plural(targetCount)}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
