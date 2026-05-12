import type { TriggerKind } from '@/shared/schemas/job'

interface TriggerShape {
  triggerKind: TriggerKind
  cronExpression: string | null
  intervalSeconds: number | null
}

interface TimezonedTrigger extends TriggerShape {
  triggerTimezone: string | null
}

export function triggerSummary(t: TriggerShape): string {
  if (t.triggerKind === 'cron') return `cron ${t.cronExpression ?? ''}`.trimEnd()
  if (t.triggerKind === 'interval') return `every ${t.intervalSeconds ?? 0}s`
  return 'webhook'
}

export function triggerSummaryWithTimezone(t: TimezonedTrigger): string {
  if (t.triggerKind === 'cron' && t.triggerTimezone) {
    return `cron ${t.cronExpression ?? ''} (${t.triggerTimezone})`
  }
  return triggerSummary(t)
}
