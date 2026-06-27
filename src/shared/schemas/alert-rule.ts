import { nameField, slugField } from './fields'
import { z } from './openapi'

export const ALERT_RULE_KINDS = [
  'first_failure',
  'consecutive_failures',
  'recovery',
  'slow_run',
  'missed_schedule',
] as const
export type AlertRuleKind = (typeof ALERT_RULE_KINDS)[number]

export const ALERT_RULE_SCOPES = ['workspace', 'job'] as const
export type AlertRuleScope = (typeof ALERT_RULE_SCOPES)[number]

export const CONSECUTIVE_FAILURES_DEFAULT_COUNT = 3
export const CONSECUTIVE_FAILURES_MIN = 2
export const CONSECUTIVE_FAILURES_MAX = 50
export const SLOW_RUN_DEFAULT_MS = 30_000
export const SLOW_RUN_MIN_MS = 1_000
export const MISSED_SCHEDULE_DEFAULT_MINUTES = 14 * 24 * 60
export const MISSED_SCHEDULE_MIN_MINUTES = 1
export const MISSED_SCHEDULE_MAX_MINUTES = 365 * 24 * 60

const firstFailureConfig = z
  .object({ kind: z.literal('first_failure') })
  .meta({ id: 'AlertRuleConfigFirstFailure' })

const consecutiveFailuresConfig = z
  .object({
    kind: z.literal('consecutive_failures'),
    count: z
      .int()
      .min(CONSECUTIVE_FAILURES_MIN, `Must be at least ${CONSECUTIVE_FAILURES_MIN}`)
      .max(CONSECUTIVE_FAILURES_MAX, `Must be at most ${CONSECUTIVE_FAILURES_MAX}`)
      .default(CONSECUTIVE_FAILURES_DEFAULT_COUNT),
  })
  .meta({ id: 'AlertRuleConfigConsecutiveFailures' })

const recoveryConfig = z
  .object({ kind: z.literal('recovery') })
  .meta({ id: 'AlertRuleConfigRecovery' })

const slowRunConfig = z
  .object({
    kind: z.literal('slow_run'),
    threshold_ms: z
      .int()
      .min(SLOW_RUN_MIN_MS, `Threshold must be at least ${SLOW_RUN_MIN_MS}ms`)
      .default(SLOW_RUN_DEFAULT_MS),
  })
  .meta({ id: 'AlertRuleConfigSlowRun' })

const missedScheduleConfig = z
  .object({
    kind: z.literal('missed_schedule'),
    silence_threshold_minutes: z
      .int()
      .min(
        MISSED_SCHEDULE_MIN_MINUTES,
        `Window must be at least ${MISSED_SCHEDULE_MIN_MINUTES} minute`,
      )
      .max(
        MISSED_SCHEDULE_MAX_MINUTES,
        `Window must be at most ${MISSED_SCHEDULE_MAX_MINUTES} minutes`,
      )
      .default(MISSED_SCHEDULE_DEFAULT_MINUTES),
  })
  .meta({ id: 'AlertRuleConfigMissedSchedule' })

export const AlertRuleConfigSchema = z
  .discriminatedUnion('kind', [
    firstFailureConfig,
    consecutiveFailuresConfig,
    recoveryConfig,
    slowRunConfig,
    missedScheduleConfig,
  ])
  .meta({ id: 'AlertRuleConfig' })

export type AlertRuleConfig = z.infer<typeof AlertRuleConfigSchema>

export const AlertRuleSchema = z
  .object({
    id: z.string().meta({ example: 'rul_abc123' }),
    scope: z.enum(ALERT_RULE_SCOPES),
    workspaceId: z.string().nullable().meta({ example: 'wsp_abc123' }),
    jobId: z.string().nullable(),
    kind: z.enum(ALERT_RULE_KINDS),
    name: z.string().meta({ example: 'Alert on first failure' }),
    slug: z.string().meta({ example: 'alert-on-first-failure' }),
    config: AlertRuleConfigSchema,
    channelIds: z.array(z.string()).min(1),
    status: z.enum(['active', 'archived']),
    lastFiredAt: z.iso.datetime().nullable(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .meta({
    id: 'AlertRule',
    description:
      'A predicate that decides when a terminal Run produces an alert, and where it fans out. Scope is workspace (every Job in the Workspace) or job (one Job). Matching rules are additive.',
  })

export type AlertRule = z.infer<typeof AlertRuleSchema>

const alertRuleMutableFields = {
  name: nameField,
  config: AlertRuleConfigSchema,
  channelIds: z.array(z.string().min(1)).min(1, 'Pick at least one Channel'),
}

export const AlertRuleCreateInput = z
  .object({ ...alertRuleMutableFields, slug: slugField })
  .meta({ id: 'AlertRuleCreateInput' })

export type AlertRuleCreateInput = z.infer<typeof AlertRuleCreateInput>

export const AlertRuleUpdateInput = z
  .object(alertRuleMutableFields)
  .meta({ id: 'AlertRuleUpdateInput' })

export type AlertRuleUpdateInput = z.infer<typeof AlertRuleUpdateInput>

export function summarizeRuleConfig(config: AlertRuleConfig): string {
  switch (config.kind) {
    case 'first_failure':
      return 'On first failure'
    case 'consecutive_failures':
      return `On ${config.count} consecutive failures`
    case 'recovery':
      return 'On recovery'
    case 'slow_run':
      return `When Run > ${config.threshold_ms}ms`
    case 'missed_schedule':
      return `When no Run starts for ${config.silence_threshold_minutes}m`
  }
}
