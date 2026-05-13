import { queryOptions, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'
import { DateTime } from '@/components/DateTime'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  generateWebhookSecretFn,
  listWebhookSecretsFn,
  revokeWebhookSecretsFn,
  rotateWebhookSecretFn,
} from '@/lib/webhook-secrets/server-fns'
import type {
  WebhookSecretCreatedResponse,
  WebhookSecretSummary,
} from '@/shared/schemas/webhook-secret'

const DEFAULT_OVERLAP_HOURS = 24

const webhookSecretsOptions = (customerSlug: string, jobSlug: string) =>
  queryOptions({
    queryKey: ['jobs', customerSlug, jobSlug, 'webhook-secrets'],
    queryFn: () => listWebhookSecretsFn({ data: { customerSlug, jobSlug } }),
  })

interface WebhookSecretPanelProps {
  customerSlug: string
  jobSlug: string
  origin?: string
}

async function copyToClipboard(value: string, label: string) {
  try {
    await navigator.clipboard.writeText(value)
    toast.success(`${label} copied`)
  } catch {
    toast.error('Unable to copy. Check clipboard permissions.')
  }
}

function isActive(secret: WebhookSecretSummary, now: number): boolean {
  if (secret.revokedAt) return false
  if (secret.expiresAt && new Date(secret.expiresAt).getTime() <= now) return false
  return true
}

export function WebhookSecretPanel({ customerSlug, jobSlug, origin }: WebhookSecretPanelProps) {
  const queryClient = useQueryClient()
  const { data } = useQuery(webhookSecretsOptions(customerSlug, jobSlug))
  const [justGenerated, setJustGenerated] = useState<WebhookSecretCreatedResponse | null>(null)
  const [rotateOpen, setRotateOpen] = useState(false)
  const [revokeOpen, setRevokeOpen] = useState(false)
  const [overlapHours, setOverlapHours] = useState(DEFAULT_OVERLAP_HOURS)
  const [pending, setPending] = useState(false)

  const inferredOrigin =
    origin ?? (typeof window !== 'undefined' ? window.location.origin : 'https://<host>')
  const url = `${inferredOrigin}/w/${customerSlug}/${jobSlug}`

  const now = Date.now()
  const active = (data?.secrets ?? []).filter((s) => isActive(s, now))
  const newestActive = active[0]
  const rotating = active.find((s) => s.expiresAt !== null)

  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: ['jobs', customerSlug, jobSlug, 'webhook-secrets'],
    })

  const onGenerate = async () => {
    setPending(true)
    try {
      const result = await generateWebhookSecretFn({ data: { customerSlug, jobSlug } })
      setJustGenerated(result)
      await invalidate()
    } finally {
      setPending(false)
    }
  }

  const onRotate = async () => {
    setPending(true)
    try {
      const result = await rotateWebhookSecretFn({
        data: { customerSlug, jobSlug, overlapHours },
      })
      setJustGenerated(result)
      setRotateOpen(false)
      await invalidate()
    } finally {
      setPending(false)
    }
  }

  const onRevoke = async () => {
    setPending(true)
    try {
      await revokeWebhookSecretsFn({ data: { customerSlug, jobSlug } })
      setJustGenerated(null)
      setRevokeOpen(false)
      await invalidate()
      toast.success('All secrets revoked')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-md border border-border bg-muted/30 p-4">
      <div className="flex flex-col gap-2">
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
            onClick={() => copyToClipboard(url, 'Webhook URL')}
          >
            Copy
          </Button>
        </div>
      </div>

      <div className="border-t border-border pt-4">
        {justGenerated ? (
          <JustGeneratedState created={justGenerated} onDismiss={() => setJustGenerated(null)} />
        ) : newestActive ? (
          <ActiveState
            newest={newestActive}
            rotating={rotating ?? null}
            onRotate={() => setRotateOpen(true)}
            onRevoke={() => setRevokeOpen(true)}
          />
        ) : (
          <EmptyState onGenerate={onGenerate} disabled={pending} />
        )}
      </div>

      <AlertDialog open={rotateOpen} onOpenChange={setRotateOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rotate signing secret</AlertDialogTitle>
            <AlertDialogDescription>
              A fresh secret is generated. The current secret keeps verifying for the overlap window
              so the external caller has time to switch over.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="overlap-hours">Overlap window (hours)</Label>
            <Input
              id="overlap-hours"
              type="number"
              min={1}
              max={168}
              value={overlapHours}
              onChange={(e) => setOverlapHours(Number(e.target.value))}
            />
            <p className="text-xs text-muted-foreground">Between 1 and 168 hours (7 days).</p>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onRotate} disabled={pending}>
              Rotate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={revokeOpen} onOpenChange={setRevokeOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke all signing secrets?</AlertDialogTitle>
            <AlertDialogDescription>
              The webhook URL will reject requests until a new secret is generated. The external
              caller cannot deliver until then.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={onRevoke} disabled={pending}>
              Revoke all
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function EmptyState({ onGenerate, disabled }: { onGenerate: () => void; disabled: boolean }) {
  return (
    <div className="flex flex-col items-start gap-3">
      <p className="text-sm text-muted-foreground">
        No signing secret yet. The webhook URL will reject requests until you generate one.
      </p>
      <Button type="button" size="sm" onClick={onGenerate} disabled={disabled}>
        Generate secret
      </Button>
    </div>
  )
}

function JustGeneratedState({
  created,
  onDismiss,
}: {
  created: WebhookSecretCreatedResponse
  onDismiss: () => void
}) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm">
        Copy this secret into the external system that signs requests. boop never shows it again.
      </p>
      <div className="flex items-center gap-2">
        <code className="grow break-all rounded bg-background px-2 py-1 font-mono text-sm">
          {created.plaintext}
        </code>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => copyToClipboard(created.plaintext, 'Secret')}
        >
          Copy
        </Button>
      </div>
      <Button type="button" size="sm" className="self-start" onClick={onDismiss}>
        I've saved it
      </Button>
    </div>
  )
}

function ActiveState({
  newest,
  rotating,
  onRotate,
  onRevoke,
}: {
  newest: WebhookSecretSummary
  rotating: WebhookSecretSummary | null
  onRotate: () => void
  onRevoke: () => void
}) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm">
        <span className="text-muted-foreground">Current secret created on </span>
        <span className="font-medium">
          <DateTime value={newest.createdAt} />
        </span>
      </p>
      {rotating ? (
        <p className="text-xs text-muted-foreground">
          Previous secret expires <DateTime value={rotating.expiresAt} />
        </p>
      ) : null}
      <div className="flex items-center gap-2">
        <Button type="button" size="sm" variant="outline" onClick={onRotate}>
          Rotate
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onRevoke}>
          Revoke all
        </Button>
      </div>
    </div>
  )
}
