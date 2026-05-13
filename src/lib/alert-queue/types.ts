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
