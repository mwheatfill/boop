import { Container, Copy, Monitor, Terminal } from 'lucide-react'
import type { ComponentType } from 'react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { copyToClipboard } from '@/lib/clipboard'

interface Platform {
  id: string
  label: string
  icon: ComponentType<{ className?: string }>
  install: string
  uninstall: string
}

function platforms(token: string): Platform[] {
  return [
    {
      id: 'windows',
      label: 'Windows',
      icon: Monitor,
      install: `New-Item -ItemType Directory -Force C:\\Cloudflared\\bin > $null; Invoke-WebRequest https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe -OutFile C:\\Cloudflared\\bin\\cloudflared.exe; C:\\Cloudflared\\bin\\cloudflared.exe service install ${token}`,
      uninstall: `C:\\Cloudflared\\bin\\cloudflared.exe service uninstall`,
    },
    {
      id: 'linux',
      label: 'Linux',
      icon: Terminal,
      install: `sudo cloudflared service install ${token}`,
      uninstall: `sudo cloudflared service uninstall`,
    },
    {
      id: 'docker',
      label: 'Docker',
      icon: Container,
      install: `docker run -d --name cloudflared cloudflare/cloudflared:latest tunnel --no-autoupdate run --token ${token}`,
      uninstall: `docker rm -f cloudflared`,
    },
  ]
}

export function TunnelInstallCommands({ installToken }: { installToken: string }) {
  const list = platforms(installToken)
  return (
    <div className="flex flex-col gap-4">
      <Tabs defaultValue="windows">
        <TabsList className="w-full">
          {list.map((p) => (
            <TabsTrigger key={p.id} value={p.id}>
              <p.icon /> {p.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {list.map((p) => (
          <TabsContent key={p.id} value={p.id} className="flex flex-col gap-3 pt-1">
            <CommandBlock title="Install" platform={p.label} command={p.install} />
            <CommandBlock title="Uninstall" platform={p.label} command={p.uninstall} />
          </TabsContent>
        ))}
      </Tabs>
      <p className="text-xs text-muted-foreground">
        Needs outbound UDP 7844 to Cloudflare; one connector per host. On Windows, run PowerShell as
        Administrator.
      </p>
    </div>
  )
}

function CommandBlock({
  title,
  platform,
  command,
}: {
  title: string
  platform: string
  command: string
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">{title}</span>
        <Button
          type="button"
          size="icon-xs"
          variant="ghost"
          aria-label={`Copy ${platform} ${title.toLowerCase()} command`}
          onClick={() => void copyToClipboard(command, `${title} command copied`)}
        >
          <Copy aria-hidden />
        </Button>
      </div>
      <pre className="overflow-x-auto rounded-md border border-border bg-muted/30 px-3 py-2">
        <code className="font-mono text-xs">{command}</code>
      </pre>
    </div>
  )
}
