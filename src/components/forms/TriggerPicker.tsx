import { CalendarClock, ChevronDown, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import { ManualScheduler } from '@/components/forms/ManualScheduler'
import { ScheduleNlBox } from '@/components/forms/ScheduleNlBox'
import { SCHEDULE_PRESETS, type SchedulePreset } from '@/components/forms/schedule-presets'
import { WebhookSecretPanel } from '@/components/forms/WebhookSecretPanel'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { describeCron } from '@/lib/cron/describe'
import { nextRuns } from '@/lib/cron/next-runs'
import { cn } from '@/lib/utils'
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

// The description is derived from the persisted schedule (preset label, then the
// parsed cron, then a neutral fallback) and never from the AI's free-text
// summary, so the preview cannot disagree with what actually runs.
function describeSchedule(value: TriggerPickerValue): string {
  if (value.triggerKind === 'interval') return intervalText(value.intervalSeconds)
  const preset = SCHEDULE_PRESETS.find((p) => matchesPreset(value, p))
  if (preset) return preset.label
  return describeCron(value.cronExpression) ?? 'Custom schedule'
}

interface NextRun {
  absolute: string
  relative: string
}

const RELATIVE_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['day', 86_400_000],
  ['hour', 3_600_000],
  ['minute', 60_000],
  ['second', 1_000],
]

function formatRelative(date: Date, now: number): string {
  const rtf = new Intl.RelativeTimeFormat('en-US', { numeric: 'auto', style: 'short' })
  const diff = date.getTime() - now
  for (const [unit, ms] of RELATIVE_UNITS) {
    if (Math.abs(diff) >= ms) return rtf.format(Math.round(diff / ms), unit)
  }
  return rtf.format(0, 'second')
}

// The upcoming fire times are computed from the cron itself (CONTEXT.md
// "Schedule": previewed with its next fire times before confirm).
function upcomingRuns(value: TriggerPickerValue, timezone: string): NextRun[] {
  if (value.triggerKind === 'interval') return []
  try {
    const runs = nextRuns({ expression: value.cronExpression, timezone, n: 3 })
    const absolute = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      dateStyle: 'medium',
      timeStyle: 'short',
    })
    const now = Date.now()
    return runs.map((date) => ({
      absolute: absolute.format(date),
      relative: formatRelative(date, now),
    }))
  } catch {
    return []
  }
}

export function TriggerPicker({
  value,
  onChange,
  workspaceSlug,
  workspaceTimezone,
  webhookEditJobSlug,
}: TriggerPickerProps) {
  const tab =
    value.triggerKind === 'webhook'
      ? 'webhook'
      : value.triggerKind === 'manual'
        ? 'manual'
        : 'schedule'
  const timezone = value.triggerTimezone || workspaceTimezone
  const [aiSummary, setAiSummary] = useState<string | null>(null)
  const description = describeSchedule(value)
  const runs = upcomingRuns(value, timezone)
  const hasSchedule =
    value.triggerKind === 'interval'
      ? value.intervalSeconds > 0
      : value.cronExpression.trim() !== ''

  const selectTab = (next: string) => {
    if (next === 'webhook') onChange({ ...value, triggerKind: 'webhook' })
    else if (next === 'manual') onChange({ ...value, triggerKind: 'manual' })
    else if (value.triggerKind === 'webhook' || value.triggerKind === 'manual')
      onChange({ ...value, triggerKind: 'cron' })
  }

  return (
    <Tabs value={tab} onValueChange={selectTab}>
      <TabsList>
        <TabsTrigger value="schedule">Schedule</TabsTrigger>
        <TabsTrigger value="webhook">Webhook</TabsTrigger>
        <TabsTrigger value="manual">Manual</TabsTrigger>
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
          <div className="overflow-hidden rounded-lg border border-border bg-card">
            <div className="flex items-start gap-3 p-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                <CalendarClock className="size-4" aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-foreground">{description}</p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {value.triggerKind === 'cron' ? (
                    <>
                      {timezone} · <code className="font-mono">{value.cronExpression}</code>
                    </>
                  ) : (
                    <code className="font-mono">every {value.intervalSeconds}s</code>
                  )}
                </p>
              </div>
            </div>

            <div className="border-t border-border px-3 py-2.5">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Next runs
              </p>
              {value.triggerKind === 'interval' ? (
                <p className="mt-1.5 text-sm text-muted-foreground">
                  Runs one right after another; a slow run delays the next one.
                </p>
              ) : runs.length ? (
                <ul className="mt-1.5 flex flex-col gap-1.5">
                  {runs.map((run, i) => (
                    <li key={run.absolute} className="flex items-center gap-2.5 text-sm">
                      <span
                        className={cn(
                          'size-1.5 shrink-0 rounded-full',
                          i === 0 ? 'bg-primary' : 'bg-muted-foreground/40',
                        )}
                        aria-hidden
                      />
                      <span
                        className={cn(
                          'flex-1 tabular-nums',
                          i === 0 ? 'font-medium text-foreground' : 'text-muted-foreground',
                        )}
                      >
                        {run.absolute}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">{run.relative}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1.5 text-sm text-muted-foreground">
                  Couldn't read this schedule. Set it manually below.
                </p>
              )}
            </div>

            {aiSummary ? (
              <div className="flex items-start gap-2 border-t border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                <Sparkles className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                <span>
                  AI read that as: <span className="text-foreground">“{aiSummary}”</span>
                </span>
              </div>
            ) : null}
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
            Webhook Jobs run when another system sends them a request. The receiver URL works once
            the Job is created.
          </p>
        )}
        {webhookEditJobSlug ? (
          <WebhookSecretPanel workspaceSlug={workspaceSlug} jobSlug={webhookEditJobSlug} />
        ) : null}
      </TabsContent>

      <TabsContent value="manual" className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">
          Runs only when you start it with Run now. No automatic schedule.
        </p>
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
