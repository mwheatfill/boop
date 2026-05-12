import type { AlertRuleKind } from '@/shared/schemas/alert-rule'

export interface AlertQueueMessage {
  runId: string
  ruleId: string
  channelId: string
  ruleName: string
  ruleKind: AlertRuleKind
  test?: boolean
}
