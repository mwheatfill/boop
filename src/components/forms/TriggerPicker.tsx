import { useEffect, useState } from 'react'
import { CronPreview } from '@/components/forms/CronPreview'
import { CRON_QUICK_PICKS } from '@/components/forms/cron-quick-picks'
import { firesPerDay, IntervalChips } from '@/components/forms/IntervalChips'
import { TimezoneCombobox } from '@/components/forms/TimezoneCombobox'
import { WebhookSecretPanel } from '@/components/forms/WebhookSecretPanel'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { TriggerKind } from '@/shared/schemas/job'

export interface TriggerPickerValue {
  triggerKind: TriggerKind
  cronExpression: string
  intervalSeconds: number
  triggerTimezone: string
}

interface TriggerPickerProps {
  value: TriggerPickerValue
  onChange: (next: TriggerPickerValue) => void
  customerSlug: string
  customerTimezone: string
  webhookEditJobSlug?: string
}

export function TriggerPicker({
  value,
  onChange,
  customerSlug,
  customerTimezone,
  webhookEditJobSlug,
}: TriggerPickerProps) {
  const set = <K extends keyof TriggerPickerValue>(key: K, next: TriggerPickerValue[K]) =>
    onChange({ ...value, [key]: next })

  return (
    <Tabs value={value.triggerKind} onValueChange={(k) => set('triggerKind', k as TriggerKind)}>
      <TabsList>
        <TabsTrigger value="cron">Cron</TabsTrigger>
        <TabsTrigger value="interval">Interval</TabsTrigger>
        <TabsTrigger value="webhook">Webhook</TabsTrigger>
      </TabsList>

      <TabsContent value="cron" className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-1.5">
          {CRON_QUICK_PICKS.map((q) => (
            <Button
              key={q.expression}
              type="button"
              variant={value.cronExpression === q.expression ? 'default' : 'outline'}
              size="xs"
              onClick={() => set('cronExpression', q.expression)}
            >
              {q.label}
            </Button>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
          <div className="flex flex-col gap-2">
            <Label htmlFor="cron-expression" className="text-xs">
              Expression
            </Label>
            <Input
              id="cron-expression"
              value={value.cronExpression}
              placeholder="0 9 * * 1-5"
              className="font-mono"
              onChange={(e) => set('cronExpression', e.currentTarget.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label className="text-xs">Timezone</Label>
            <TimezoneCombobox
              value={value.triggerTimezone || customerTimezone}
              onValueChange={(tz) => set('triggerTimezone', tz)}
            />
          </div>
        </div>
        <div className="rounded-md border border-border bg-muted/30 px-3 py-3">
          <CronPreview
            expression={value.cronExpression}
            timezone={value.triggerTimezone || customerTimezone}
            count={3}
          />
        </div>
      </TabsContent>

      <TabsContent value="interval" className="flex flex-col gap-3">
        <IntervalChips value={value.intervalSeconds} onChange={(s) => set('intervalSeconds', s)} />
        <div className="flex flex-col gap-2">
          <Label htmlFor="interval-seconds" className="text-xs">
            Custom (seconds)
          </Label>
          <Input
            id="interval-seconds"
            type="number"
            min={1}
            value={value.intervalSeconds}
            onChange={(e) => set('intervalSeconds', Number(e.currentTarget.value) || 0)}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Fires ~{firesPerDay(value.intervalSeconds).toLocaleString()}/day.
        </p>
        {value.intervalSeconds > 0 && value.intervalSeconds < 60 ? (
          <p className="rounded-md border border-warning/40 bg-warning/10 px-2 py-1.5 text-xs">
            For 1m+ intervals, prefer cron. Same behavior, cheaper.
          </p>
        ) : null}
      </TabsContent>

      <TabsContent value="webhook" className="flex flex-col gap-3">
        {webhookEditJobSlug ? (
          <WebhookReceiverUrl customerSlug={customerSlug} jobSlug={webhookEditJobSlug} />
        ) : (
          <p className="text-sm text-muted-foreground">
            Webhook Jobs fire on inbound HTTP POST. The receiver URL is valid once the Job is
            created.
          </p>
        )}
        {webhookEditJobSlug ? (
          <WebhookSecretPanel customerSlug={customerSlug} jobSlug={webhookEditJobSlug} />
        ) : null}
      </TabsContent>
    </Tabs>
  )
}

function WebhookReceiverUrl({ customerSlug, jobSlug }: { customerSlug: string; jobSlug: string }) {
  const url = `${typeof window === 'undefined' ? '' : window.location.origin}/w/${customerSlug}/${jobSlug}`
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(false), 1500)
    return () => clearTimeout(t)
  }, [copied])
  return (
    <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2">
      <code className="flex-1 truncate font-mono text-xs">{url}</code>
      <Button
        type="button"
        size="xs"
        variant="outline"
        onClick={async () => {
          await navigator.clipboard.writeText(url)
          setCopied(true)
        }}
      >
        {copied ? 'Copied' : 'Copy'}
      </Button>
    </div>
  )
}
