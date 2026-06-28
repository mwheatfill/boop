import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Copy } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { EntityModal } from '@/components/forms/EntityModal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { copyToClipboard } from '@/lib/clipboard'
import { slugify } from '@/lib/slug/slugify'
import { provisionTunnelFn } from '@/lib/tunnels/server-fns'

interface Provisioned {
  hostname: string
  installToken: string
}

export function TunnelModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [internalOrigin, setInternalOrigin] = useState('')
  const [result, setResult] = useState<Provisioned | null>(null)

  const provision = useMutation({
    mutationFn: () =>
      provisionTunnelFn({
        data: { name: name.trim(), slug: slugify(name), internalOrigin: internalOrigin.trim() },
      }),
    onSuccess: (r) => {
      setResult({ hostname: r.hostname, installToken: r.installToken })
      void queryClient.invalidateQueries({ queryKey: ['tunnels'] })
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Provisioning failed'),
  })

  if (result) {
    const windows = `New-Item -ItemType Directory -Force C:\\Cloudflared\\bin > $null; Invoke-WebRequest https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe -OutFile C:\\Cloudflared\\bin\\cloudflared.exe; C:\\Cloudflared\\bin\\cloudflared.exe service install ${result.installToken}`
    const shell = `sudo cloudflared service install ${result.installToken}`
    const docker = `docker run cloudflare/cloudflared:latest tunnel --no-autoupdate run --token ${result.installToken}`
    return (
      <EntityModal
        open
        onClose={onClose}
        size="wide"
        title="Install the connector"
        description="Run one of these on a host inside the private network. The tunnel comes online within a minute, then shows as Operational."
        primaryAction={{ label: 'Done', onClick: onClose }}
      >
        <div className="flex flex-col gap-4 rounded-md border border-border bg-card p-4">
          <CommandBlock label="Windows (PowerShell, as Administrator)" command={windows} />
          <CommandBlock label="Linux / systemd" command={shell} />
          <CommandBlock label="Docker" command={docker} />
          <div className="flex flex-col gap-1 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">Before you run it</p>
            <p>
              On Windows, open PowerShell as Administrator; cloudflared installs as a Windows
              service. The internal origin points at IIS (e.g. http://localhost or the server's LAN
              address).
            </p>
            <p>
              The host needs outbound access to Cloudflare on UDP port 7844 (TCP 7844 fallback).
            </p>
            <p>Only one cloudflared service runs per host; reuse a host by adding routes.</p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Hostname: <code className="font-mono text-xs text-foreground">{result.hostname}</code>
        </p>
      </EntityModal>
    )
  }

  const canSubmit = name.trim().length > 0 && internalOrigin.trim().length > 0

  return (
    <EntityModal
      open
      onClose={onClose}
      title="New private tunnel"
      description="boop provisions the Cloudflare Tunnel, then gives you one command to run on the customer's network."
      dirty={name.length > 0 || internalOrigin.length > 0}
      primaryAction={{
        label: 'Create tunnel',
        onClick: () => provision.mutate(),
        loading: provision.isPending,
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
          The private address the tunnel forwards to, reachable from the host running cloudflared.
        </p>
      </div>
    </EntityModal>
  )
}

function CommandBlock({ label, command }: { label: string; command: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2">
        <code className="flex-1 overflow-x-auto font-mono text-xs">{command}</code>
        <Button
          type="button"
          size="xs"
          variant="outline"
          aria-label={`Copy ${label}`}
          onClick={() => void copyToClipboard(command, `${label} copied`)}
        >
          <Copy aria-hidden />
        </Button>
      </div>
    </div>
  )
}
