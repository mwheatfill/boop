import type { AlertRuleKind } from '@/shared/schemas/alert-rule'

export interface RunAlertQueueMessage {
  runId: string
  ruleId: string
  channelId: string
  ruleName: string
  ruleKind: Exclude<AlertRuleKind, 'missed_schedule'>
  test?: boolean
}

export interface MissedScheduleAlertQueueMessage {
  jobId: string
  ruleId: string
  channelId: string
  ruleName: string
  ruleKind: 'missed_schedule'
  lastRunAt: string | null
  silenceThresholdMinutes: number
  test?: false
}

export type AlertQueueMessage = RunAlertQueueMessage | MissedScheduleAlertQueueMessage

export function isRunAlertMessage(message: AlertQueueMessage): message is RunAlertQueueMessage {
  return 'runId' in message
}

// One firing missed-schedule rule against a Job. The enqueue producer fans this
// out to one queue message per channel, so callers hand over the resolved set
// without knowing the on-the-wire message shape.
export interface MissedScheduleFanout {
  jobId: string
  ruleId: string
  ruleName: string
  channelIds: readonly string[]
  lastRunAt: Date | null
  silenceThresholdMinutes: number
}
