import { Check, ChevronDown } from 'lucide-react'
import { useEffect, useState } from 'react'
import { ManualScheduler } from '@/components/forms/ManualScheduler'
import { ScheduleNlBox } from '@/components/forms/ScheduleNlBox'
import { SCHEDULE_PRESETS, type SchedulePreset } from '@/components/forms/schedule-presets'
import { WebhookSecretPanel } from '@/components/forms/WebhookSecretPanel'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { nextRuns } from '@/lib/cron/next-runs'
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
  workspaceSlug: string
  workspaceTimezone: string
  webhookEditJobSlug?: string
}

const DEFAULT_CRON = '0 9 * * *'

function matchesPreset(value: TriggerPickerValue, preset: SchedulePreset): boolean {
  if (preset.kind !== value.triggerKind) return false
  return preset.kind === 'cron'
    ? preset.cronExpression === value.cronExpression
    : preset.intervalSeconds === value.intervalSeconds
}

function intervalText(seconds: number): string {
  if (seconds >= 3600 && seconds % 3600 === 0) {
    const h = seconds / 3600
    return `Every ${h} hour${h === 1 ? '' : 's'}`
  }
  if (seconds >= 60 && seconds % 60 === 0) {
    const m = seconds / 60
    return `Every ${m} minute${m === 1 ? '' : 's'}`
  }
  return `Every ${seconds} seconds`
}

function describeSchedule(value: TriggerPickerValue, aiSummary: string | null): string {
  if (value.triggerKind === 'interval') return intervalText(value.intervalSeconds)
  const preset = SCHEDULE_PRESETS.find((p) => matchesPreset(value, p))
  if (preset) return preset.label
  return aiSummary ?? 'Custom schedule'
}

function nextRunLine(value: TriggerPickerValue, timezone: string): string | null {
  if (value.triggerKind === 'interval') return 'Runs back-to-back; a slow run delays the next.'
  try {
    const [next] = nextRuns({ expression: value.cronExpression, timezone, n: 1 })
    if (!next) return null
    const formatted = Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(next)
    return `Next run ${formatted} · ${timezone}`
  } catch {
    return null
  }
}

export function TriggerPicker({
  value,
  onChange,
  workspaceSlug,
  workspaceTimezone,
  webhookEditJobSlug,
}: TriggerPickerProps) {
  const tab = value.triggerKind === 'webhook' ? 'webhook' : 'schedule'
  const timezone = value.triggerTimezone || workspaceTimezone
  const [aiSummary, setAiSummary] = useState<string | null>(null)
  const description = describeSchedule(value, aiSummary)
  const nextLine = nextRunLine(value, timezone)
  const hasSchedule =
    value.triggerKind === 'interval'
      ? value.intervalSeconds > 0
      : value.cronExpression.trim() !== ''

  const selectTab = (next: string) => {
    if (next === 'webhook') {
      onChange({ ...value, triggerKind: 'webhook' })
    } else if (value.triggerKind === 'webhook') {
      onChange({
        ...value,
        triggerKind: 'cron',
        cronExpression: value.cronExpression || DEFAULT_CRON,
      })
    }
  }

  return (
    <Tabs value={tab} onValueChange={selectTab}>
      <TabsList>
        <TabsTrigger value="schedule">Schedule</TabsTrigger>
        <TabsTrigger value="webhook">Webhook</TabsTrigger>
      </TabsList>

      <TabsContent value="schedule" className="flex flex-col gap-3">
        <ScheduleNlBox
          timezone={timezone}
          onApply={(p) => {
            setAiSummary(p.summary)
            onChange({
              ...value,
              triggerKind: p.triggerKind,
              cronExpression: p.triggerKind === 'cron' ? p.cronExpression : value.cronExpression,
              intervalSeconds:
                p.triggerKind === 'interval' ? p.intervalSeconds : value.intervalSeconds,
            })
          }}
        />

        {hasSchedule ? (
          <div className="flex flex-col gap-1 rounded-md border border-border bg-muted/30 px-3 py-2">
            <div className="flex items-center gap-2 text-sm">
              <Check className="size-4 shrink-0 text-success" aria-hidden />
              <span className="font-medium text-foreground">{description}</span>
            </div>
            {nextLine ? <p className="pl-6 text-xs text-muted-foreground">{nextLine}</p> : null}
          </div>
        ) : (
          <div className="rounded-md border border-dashed border-border px-3 py-4 text-center text-sm text-muted-foreground">
            No schedule yet. Describe one above, or set it manually.
          </div>
        )}

        <Collapsible>
          <CollapsibleTrigger className="group/manual flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground">
            <ChevronDown
              className="size-3.5 transition-transform group-data-[panel-open]/manual:rotate-180"
              aria-hidden
            />
            Set it manually
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-3">
            <ManualScheduler
              cronExpression={value.cronExpression}
              timezone={timezone}
              onChange={(cron) => {
                setAiSummary(null)
                onChange({ ...value, triggerKind: 'cron', cronExpression: cron })
              }}
              onTimezone={(tz) => onChange({ ...value, triggerTimezone: tz })}
            />
          </CollapsibleContent>
        </Collapsible>
      </TabsContent>

      <TabsContent value="webhook" className="flex flex-col gap-3">
        {webhookEditJobSlug ? (
          <WebhookReceiverUrl workspaceSlug={workspaceSlug} jobSlug={webhookEditJobSlug} />
        ) : (
          <p className="text-sm text-muted-foreground">
            Webhook Jobs fire on inbound HTTP POST. The receiver URL is valid once the Job is
            created.
          </p>
        )}
        {webhookEditJobSlug ? (
          <WebhookSecretPanel workspaceSlug={workspaceSlug} jobSlug={webhookEditJobSlug} />
        ) : null}
      </TabsContent>
    </Tabs>
  )
}

function WebhookReceiverUrl({
  workspaceSlug,
  jobSlug,
}: {
  workspaceSlug: string
  jobSlug: string
}) {
  const url = `${typeof window === 'undefined' ? '' : window.location.origin}/w/${workspaceSlug}/${jobSlug}`
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
