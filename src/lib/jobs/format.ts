import type { TriggerKind } from '@/shared/schemas/job'

interface TriggerShape {
  triggerKind: TriggerKind
  cronExpression: string | null
  intervalSeconds: number | null
  triggerTimezone: string | null
}

export function triggerSummary(t: TriggerShape): string {
  if (t.triggerKind === 'cron') {
    return t.triggerTimezone
      ? `cron ${t.cronExpression ?? ''} (${t.triggerTimezone})`
      : `cron ${t.cronExpression ?? ''}`.trimEnd()
  }
  if (t.triggerKind === 'interval') return `every ${t.intervalSeconds ?? 0}s`
  return 'webhook'
}
