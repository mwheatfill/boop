import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

interface WebhookUrlPanelProps {
  customerSlug: string
  jobSlug: string
  origin?: string
}

export function WebhookUrlPanel({ customerSlug, jobSlug, origin }: WebhookUrlPanelProps) {
  const [copied, setCopied] = useState(false)
  const inferredOrigin =
    origin ?? (typeof window !== 'undefined' ? window.location.origin : 'https://<host>')
  const url = `${inferredOrigin}/w/${customerSlug}/${jobSlug}`

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border bg-muted/40 p-4">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Webhook URL
      </p>
      <div className="flex items-center gap-2">
        <code className="grow break-all rounded bg-background px-2 py-1 font-mono text-sm">
          {url}
        </code>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(url)
              setCopied(true)
              toast.success('Webhook URL copied')
              setTimeout(() => setCopied(false), 1500)
            } catch {
              toast.error('Unable to copy. Check clipboard permissions.')
            }
          }}
        >
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">Any HTTP POST to this URL fires the Job.</p>
    </div>
  )
}
