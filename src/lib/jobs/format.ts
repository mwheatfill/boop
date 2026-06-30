import { CRON_QUICK_PICKS } from '@/components/forms/cron-quick-picks'
import type { TriggerKind } from '@/shared/schemas/job'

interface TriggerShape {
  triggerKind: TriggerKind
  cronExpression: string | null
  intervalSeconds: number | null
}

interface TimezonedTrigger extends TriggerShape {
  triggerTimezone: string | null
}

// What the user sees for a trigger type: cron and interval are both just
// "Schedule" (the cron/interval split is an implementation detail).
const TRIGGER_KIND_LABELS: Record<TriggerKind, string> = {
  cron: 'Schedule',
  interval: 'Schedule',
  webhook: 'Webhook',
}

export function triggerKindLabel(kind: TriggerKind): string {
  return TRIGGER_KIND_LABELS[kind]
}

function intervalLabel(seconds: number): string {
  if (seconds >= 3600 && seconds % 3600 === 0) {
    const h = seconds / 3600
    return `Every ${h} hour${h === 1 ? '' : 's'}`
  }
  if (seconds >= 60 && seconds % 60 === 0) {
    const m = seconds / 60
    return `Every ${m} minute${m === 1 ? '' : 's'}`
  }
  return `Every ${seconds} second${seconds === 1 ? '' : 's'}`
}

function cronLabel(expression: string | null): string {
  if (!expression) return ''
  const preset = CRON_QUICK_PICKS.find((p) => p.expression === expression)
  return preset ? preset.label : expression
}

export function triggerSummary(t: TriggerShape): string {
  if (t.triggerKind === 'cron') return cronLabel(t.cronExpression) || 'Schedule'
  if (t.triggerKind === 'interval') return intervalLabel(t.intervalSeconds ?? 0)
  return 'Webhook'
}

export function triggerSummaryWithTimezone(t: TimezonedTrigger): string {
  if (t.triggerKind === 'cron' && t.triggerTimezone) {
    const label = cronLabel(t.cronExpression)
    return label ? `${label} · ${t.triggerTimezone}` : `Schedule · ${t.triggerTimezone}`
  }
  return triggerSummary(t)
}
