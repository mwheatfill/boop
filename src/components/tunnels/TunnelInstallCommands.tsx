import { Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { copyToClipboard } from '@/lib/clipboard'

export function TunnelInstallCommands({
  hostname,
  installToken,
}: {
  hostname: string
  installToken: string
}) {
  const windows = `New-Item -ItemType Directory -Force C:\\Cloudflared\\bin > $null; Invoke-WebRequest https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe -OutFile C:\\Cloudflared\\bin\\cloudflared.exe; C:\\Cloudflared\\bin\\cloudflared.exe service install ${installToken}`
  const shell = `sudo cloudflared service install ${installToken}`
  const docker = `docker run cloudflare/cloudflared:latest tunnel --no-autoupdate run --token ${installToken}`

  return (
    <>
      <div className="flex flex-col gap-4 rounded-md border border-border bg-card p-4">
        <CommandBlock label="Windows (PowerShell, as Administrator)" command={windows} />
        <CommandBlock label="Linux / systemd" command={shell} />
        <CommandBlock label="Docker" command={docker} />
        <div className="flex flex-col gap-1 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">Before you run it</p>
          <p>
            On Windows, open PowerShell as Administrator; cloudflared installs as a Windows service.
            The internal origin points at IIS (e.g. http://localhost or the server's LAN address).
          </p>
          <p>The host needs outbound access to Cloudflare on UDP port 7844 (TCP 7844 fallback).</p>
          <p>Only one cloudflared service runs per host; reuse a host by adding routes.</p>
        </div>
      </div>
      <p className="text-sm text-muted-foreground">
        Hostname: <code className="font-mono text-xs text-foreground">{hostname}</code>
      </p>
    </>
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
