import { Check, Copy } from 'lucide-react'
import { type ReactNode, useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { ChannelConfig } from '@/shared/schemas/channel'

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 py-3 first:pt-0 last:pb-0">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="text-sm text-foreground">{children}</dd>
    </div>
  )
}

function CopyableUrl({ url }: { url: string }) {
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(false), 1500)
    return () => clearTimeout(t)
  }, [copied])
  return (
    <div className="flex items-center gap-2">
      <code className="min-w-0 flex-1 truncate font-mono text-xs">{url}</code>
      <Button
        type="button"
        size="xs"
        variant="ghost"
        aria-label="Copy URL"
        onClick={async () => {
          await navigator.clipboard.writeText(url)
          setCopied(true)
        }}
      >
        {copied ? (
          <Check className="size-3.5 text-success" aria-hidden />
        ) : (
          <Copy className="size-3.5" aria-hidden />
        )}
      </Button>
    </div>
  )
}

function TemplateBlock({ children }: { children: string }) {
  return (
    <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-md border border-border bg-card p-3 font-mono text-xs text-muted-foreground">
      {children}
    </pre>
  )
}

function Headers({ headers }: { headers: Record<string, string> }) {
  const entries = Object.entries(headers)
  if (entries.length === 0) return <span className="text-muted-foreground">None</span>
  return (
    <div className="flex flex-col gap-1">
      {entries.map(([key, value]) => (
        <div key={key} className="flex gap-2 font-mono text-xs">
          <span className="shrink-0 text-foreground">{key}</span>
          <span className="break-all text-muted-foreground">{value}</span>
        </div>
      ))}
    </div>
  )
}

export function ChannelConfigDetails({ config }: { config: ChannelConfig }) {
  return (
    <dl className="flex flex-col divide-y divide-border">
      {config.kind === 'teams' ? (
        <Row label="Webhook URL">
          <CopyableUrl url={config.webhook_url} />
        </Row>
      ) : null}

      {config.kind === 'email' ? (
        <>
          <Row label="Recipients">
            <div className="flex flex-wrap gap-1.5">
              {config.recipients.map((recipient) => (
                <Badge key={recipient} variant="secondary" className="font-normal">
                  {recipient}
                </Badge>
              ))}
            </div>
          </Row>
          <Row label="Subject">
            <span className="break-words font-mono text-xs">{config.subject_template}</span>
          </Row>
          <Row label="Body">
            <TemplateBlock>{config.body_template}</TemplateBlock>
          </Row>
        </>
      ) : null}

      {config.kind === 'webhook' ? (
        <>
          <Row label="URL">
            <CopyableUrl url={config.url} />
          </Row>
          <Row label="Method">
            <Badge variant="secondary">{config.method}</Badge>
          </Row>
          <Row label="Headers">
            <Headers headers={config.headers} />
          </Row>
          <Row label="Body">
            <TemplateBlock>{config.body_template}</TemplateBlock>
          </Row>
        </>
      ) : null}
    </dl>
  )
}
