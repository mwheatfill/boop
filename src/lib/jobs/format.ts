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

function cronLabel(expression: string | null): string {
  if (!expression) return ''
  const preset = CRON_QUICK_PICKS.find((p) => p.expression === expression)
  return preset ? preset.label : expression
}

export function triggerSummary(t: TriggerShape): string {
  if (t.triggerKind === 'cron') return cronLabel(t.cronExpression) || 'cron'
  if (t.triggerKind === 'interval') return `every ${t.intervalSeconds ?? 0}s`
  return 'webhook'
}

export function triggerSummaryWithTimezone(t: TimezonedTrigger): string {
  if (t.triggerKind === 'cron' && t.triggerTimezone) {
    const label = cronLabel(t.cronExpression)
    return label ? `${label} · ${t.triggerTimezone}` : `cron · ${t.triggerTimezone}`
  }
  return triggerSummary(t)
}
