import { useMutation, useQueryClient } from '@tanstack/react-query'
import { MoreHorizontal, Pencil } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { deleteTunnelFn, rotateTunnelCredentialsFn, verifyTunnelFn } from '@/lib/tunnels/server-fns'
import type { Tunnel } from '@/shared/schemas/tunnel'

export function TunnelActions({
  tunnel,
  isAdmin,
  onEdit,
  onRemoved,
}: {
  tunnel: Tunnel
  isAdmin: boolean
  onEdit: () => void
  onRemoved: () => void
}) {
  const queryClient = useQueryClient()
  const [confirming, setConfirming] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['tunnels'] })

  const verify = useMutation({
    mutationFn: () => verifyTunnelFn({ data: { tunnelId: tunnel.id } }),
    onSuccess: (result) => {
      if (result.ok) toast.success(result.detail)
      else toast.error(result.detail)
      void invalidate()
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Verify failed'),
  })

  const rotate = useMutation({
    mutationFn: () => rotateTunnelCredentialsFn({ data: { tunnelId: tunnel.id } }),
    onSuccess: () => {
      toast.success('Access credentials rotated')
      void invalidate()
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Rotate failed'),
  })

  const remove = useMutation({
    mutationFn: () => deleteTunnelFn({ data: { tunnelId: tunnel.id } }),
    onSuccess: () => {
      toast.success('Tunnel deleted', { description: 'Find it in the Recycle Bin.' })
      setConfirming(false)
      void invalidate()
      onRemoved()
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Delete failed'),
  })

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        disabled={verify.isPending}
        onClick={() => verify.mutate()}
      >
        {verify.isPending ? 'Verifying…' : 'Verify'}
      </Button>
      {isAdmin ? (
        <Button variant="outline" size="sm" onClick={onEdit}>
          <Pencil aria-hidden /> Edit
        </Button>
      ) : null}
      {isAdmin ? (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button variant="outline" size="icon-sm" aria-label="More actions" />}
          >
            <MoreHorizontal aria-hidden />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onEdit}>Install command…</DropdownMenuItem>
            <DropdownMenuItem disabled={rotate.isPending} onClick={() => rotate.mutate()}>
              Rotate credentials
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onClick={() => setConfirming(true)}>
              Delete…
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}

      <AlertDialog
        open={confirming}
        onOpenChange={(open) => {
          setConfirming(open)
          if (!open) setConfirmText('')
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {tunnel.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the Cloudflare tunnel, and deletes the Targets that use it
              and their Jobs. It can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="confirm-tunnel-delete" className="text-sm text-muted-foreground">
              Type <span className="font-medium text-foreground">{tunnel.name}</span> to confirm
            </Label>
            <Input
              id="confirm-tunnel-delete"
              autoComplete="off"
              value={confirmText}
              onChange={(e) => setConfirmText(e.currentTarget.value)}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={remove.isPending || confirmText !== tunnel.name}
              onClick={(e) => {
                e.preventDefault()
                remove.mutate()
              }}
            >
              {remove.isPending ? 'Deleting' : 'Delete tunnel'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
