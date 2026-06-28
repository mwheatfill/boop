import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { Copy } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { copyToClipboard } from '@/lib/clipboard'
import { slugify } from '@/lib/slug/slugify'
import { provisionTunnelFn } from '@/lib/tunnels/server-fns'

export const Route = createFileRoute('/_authenticated/tunnels/new')({
  component: NewTunnelPage,
})

interface Provisioned {
  hostname: string
  installToken: string
}

function NewTunnelPage() {
  const router = useRouter()
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
    return <InstallStep result={result} onDone={() => router.navigate({ to: '/tunnels' })} />
  }

  return (
    <div className="flex max-w-xl flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">New private tunnel</h1>
        <p className="text-sm text-muted-foreground">
          boop provisions the Cloudflare Tunnel, then gives you one command to run on the customer's
          network.
        </p>
      </header>

      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          provision.mutate()
        }}
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="tunnel-name">Name</Label>
          <Input
            id="tunnel-name"
            value={name}
            onChange={(e) => setName(e.currentTarget.value)}
            placeholder="Acme HQ"
            required
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
            required
          />
          <p className="text-xs text-muted-foreground">
            The private address the tunnel forwards to, reachable from the host running cloudflared.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button type="submit" disabled={provision.isPending}>
            {provision.isPending ? 'Creating tunnel' : 'Create tunnel'}
          </Button>
          <Button type="button" variant="ghost" render={<Link to="/tunnels" />}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
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

function InstallStep({ result, onDone }: { result: Provisioned; onDone: () => void }) {
  const shell = `sudo cloudflared service install ${result.installToken}`
  const docker = `docker run cloudflare/cloudflared:latest tunnel --no-autoupdate run --token ${result.installToken}`

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Install the connector</h1>
        <p className="text-sm text-muted-foreground">
          Run one of these on a host inside the private network. The tunnel comes online within a
          minute, then shows as Operational on the Tunnels page.
        </p>
      </header>

      <div className="flex flex-col gap-4 rounded-md border border-border bg-card p-4">
        <CommandBlock label="Linux / systemd" command={shell} />
        <CommandBlock label="Docker" command={docker} />
        <div className="flex flex-col gap-1 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">Before you run it</p>
          <p>The host needs outbound access to Cloudflare on UDP port 7844 (TCP 7844 fallback).</p>
          <p>Only one cloudflared service runs per host; reuse a host by adding routes.</p>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        Hostname: <code className="font-mono text-xs text-foreground">{result.hostname}</code>
      </p>

      <div>
        <Button onClick={onDone}>Done</Button>
      </div>
    </div>
  )
}
