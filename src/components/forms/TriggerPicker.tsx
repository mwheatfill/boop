import { useEffect, useMemo, useState } from 'react'
import { CronPreview } from '@/components/forms/CronPreview'
import { CRON_QUICK_PICKS } from '@/components/forms/cron-quick-picks'
import { firesPerDay, IntervalChips } from '@/components/forms/IntervalChips'
import { ScheduleNlBox } from '@/components/forms/ScheduleNlBox'
import { SCHEDULE_PRESETS, type SchedulePreset } from '@/components/forms/schedule-presets'
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

export function TriggerPicker({
  value,
  onChange,
  workspaceSlug,
  workspaceTimezone,
  webhookEditJobSlug,
}: TriggerPickerProps) {
  const set = <K extends keyof TriggerPickerValue>(key: K, next: TriggerPickerValue[K]) =>
    onChange({ ...value, [key]: next })

  const tab = value.triggerKind === 'webhook' ? 'webhook' : 'schedule'
  const activePreset = useMemo(() => SCHEDULE_PRESETS.find((p) => matchesPreset(value, p)), [value])
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const showAdvanced = advancedOpen || (tab === 'schedule' && !activePreset)

  const applyPreset = (preset: SchedulePreset) =>
    onChange({
      ...value,
      triggerKind: preset.kind,
      cronExpression: preset.cronExpression,
      intervalSeconds: preset.intervalSeconds,
    })

  const selectTab = (next: string) => {
    if (next === 'webhook') {
      set('triggerKind', 'webhook')
    } else if (value.triggerKind === 'webhook') {
      onChange({
        ...value,
        triggerKind: 'cron',
        cronExpression: value.cronExpression || DEFAULT_CRON,
      })
    }
  }

  const setMode = (mode: 'cron' | 'interval') =>
    onChange({
      ...value,
      triggerKind: mode,
      cronExpression: mode === 'cron' ? value.cronExpression || DEFAULT_CRON : value.cronExpression,
      intervalSeconds: mode === 'interval' ? value.intervalSeconds || 300 : value.intervalSeconds,
    })

  return (
    <Tabs value={tab} onValueChange={selectTab}>
      <TabsList>
        <TabsTrigger value="schedule">Schedule</TabsTrigger>
        <TabsTrigger value="webhook">Webhook</TabsTrigger>
      </TabsList>

      <TabsContent value="schedule" className="flex flex-col gap-3">
        <ScheduleNlBox
          timezone={value.triggerTimezone || workspaceTimezone}
          onApply={(p) =>
            onChange({
              ...value,
              triggerKind: p.triggerKind,
              cronExpression: p.triggerKind === 'cron' ? p.cronExpression : value.cronExpression,
              intervalSeconds:
                p.triggerKind === 'interval' ? p.intervalSeconds : value.intervalSeconds,
            })
          }
        />
        <div className="flex flex-wrap gap-1.5">
          {SCHEDULE_PRESETS.map((preset) => (
            <Button
              key={preset.label}
              type="button"
              variant={activePreset?.label === preset.label ? 'default' : 'outline'}
              size="xs"
              onClick={() => applyPreset(preset)}
            >
              {preset.label}
            </Button>
          ))}
        </div>

        <button
          type="button"
          className="self-start text-xs text-muted-foreground hover:text-foreground"
          onClick={() => setAdvancedOpen((o) => !o)}
        >
          {showAdvanced ? 'Hide advanced' : 'Advanced'}
        </button>

        {showAdvanced ? (
          <div className="flex flex-col gap-3 rounded-md border border-border p-3">
            <div className="flex gap-1.5">
              <Button
                type="button"
                size="xs"
                variant={value.triggerKind === 'cron' ? 'default' : 'outline'}
                onClick={() => setMode('cron')}
              >
                Calendar (cron)
              </Button>
              <Button
                type="button"
                size="xs"
                variant={value.triggerKind === 'interval' ? 'default' : 'outline'}
                onClick={() => setMode('interval')}
              >
                Interval
              </Button>
            </div>

            {value.triggerKind === 'interval' ? (
              <IntervalAdvanced
                seconds={value.intervalSeconds}
                onChange={(s) => set('intervalSeconds', s)}
              />
            ) : (
              <CronAdvanced
                expression={value.cronExpression}
                timezone={value.triggerTimezone || workspaceTimezone}
                onExpression={(e) => set('cronExpression', e)}
                onTimezone={(tz) => set('triggerTimezone', tz)}
              />
            )}
          </div>
        ) : null}

        <SchedulePreview value={value} workspaceTimezone={workspaceTimezone} />
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

function IntervalAdvanced({
  seconds,
  onChange,
}: {
  seconds: number
  onChange: (s: number) => void
}) {
  return (
    <div className="flex flex-col gap-2">
      <IntervalChips value={seconds} onChange={onChange} />
      <Label htmlFor="interval-seconds" className="text-xs">
        Custom (seconds)
      </Label>
      <Input
        id="interval-seconds"
        type="number"
        min={1}
        value={seconds}
        onChange={(e) => onChange(Number(e.currentTarget.value) || 0)}
      />
      {seconds >= 60 ? (
        <p className="rounded-md border border-warning/40 bg-warning/10 px-2 py-1.5 text-xs">
          For 1m+ cadences, a Calendar (cron) schedule is cheaper for the same behavior.
        </p>
      ) : null}
    </div>
  )
}

function CronAdvanced({
  expression,
  timezone,
  onExpression,
  onTimezone,
}: {
  expression: string
  timezone: string
  onExpression: (e: string) => void
  onTimezone: (tz: string) => void
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-1.5">
        {CRON_QUICK_PICKS.map((q) => (
          <Button
            key={q.expression}
            type="button"
            variant={expression === q.expression ? 'default' : 'outline'}
            size="xs"
            onClick={() => onExpression(q.expression)}
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
            value={expression}
            placeholder="0 9 * * 1-5"
            className="font-mono"
            onChange={(e) => onExpression(e.currentTarget.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label className="text-xs">Timezone</Label>
          <TimezoneCombobox value={timezone} onValueChange={onTimezone} />
        </div>
      </div>
    </div>
  )
}

function SchedulePreview({
  value,
  workspaceTimezone,
}: {
  value: TriggerPickerValue
  workspaceTimezone: string
}) {
  if (value.triggerKind === 'interval') {
    return (
      <div className="rounded-md border border-border bg-muted/30 p-3">
        <p className="text-xs text-muted-foreground">
          Fires every {value.intervalSeconds}s (~
          {firesPerDay(value.intervalSeconds).toLocaleString()}/day).
        </p>
      </div>
    )
  }
  return (
    <div className="rounded-md border border-border bg-muted/30 p-3">
      <CronPreview
        expression={value.cronExpression}
        timezone={value.triggerTimezone || workspaceTimezone}
        count={3}
      />
    </div>
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
