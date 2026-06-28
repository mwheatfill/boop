import { useMutation, useQueryClient } from '@tanstack/react-query'
import { MoreHorizontal, Pencil } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { TunnelInstallCommands } from '@/components/tunnels/TunnelInstallCommands'
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { decommissionTunnelFn, getTunnelInstallFn, verifyTunnelFn } from '@/lib/tunnels/server-fns'
import type { Tunnel } from '@/shared/schemas/tunnel'

interface Install {
  hostname: string
  installToken: string
}

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
  const [install, setInstall] = useState<Install | null>(null)
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

  const showInstall = useMutation({
    mutationFn: () => getTunnelInstallFn({ data: { tunnelId: tunnel.id } }),
    onSuccess: (data) => setInstall(data),
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Could not load command'),
  })

  const remove = useMutation({
    mutationFn: () => decommissionTunnelFn({ data: { tunnelId: tunnel.id } }),
    onSuccess: () => {
      toast.success(`Removed ${tunnel.name}`)
      setConfirming(false)
      void invalidate()
      onRemoved()
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Remove failed'),
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
            <DropdownMenuItem disabled={showInstall.isPending} onClick={() => showInstall.mutate()}>
              Install command…
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onClick={() => setConfirming(true)}>
              Remove…
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}

      <Dialog open={install !== null} onOpenChange={(next) => !next && setInstall(null)}>
        <DialogContent size="wide">
          <DialogHeader>
            <DialogTitle>Install the connector</DialogTitle>
            <DialogDescription>
              Run one of these on a host inside the private network for {tunnel.name}.
            </DialogDescription>
          </DialogHeader>
          {install ? (
            <div className="flex flex-col gap-4">
              <TunnelInstallCommands
                hostname={install.hostname}
                installToken={install.installToken}
              />
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {tunnel.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This tears down the Cloudflare Tunnel, Access app, Service Token, and DNS record, then
              archives it. Any Targets using this tunnel must be archived first.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={remove.isPending}
              onClick={(e) => {
                e.preventDefault()
                remove.mutate()
              }}
            >
              {remove.isPending ? 'Removing' : 'Remove tunnel'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
