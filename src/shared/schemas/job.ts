import { cronSchema } from './cron'
import { nameField, slugField } from './fields'
import { z } from './openapi'
import { tzSchema } from './timezone'
import { VariableMapSchema } from './workspace-variables'

export const TRIGGER_KINDS = ['cron', 'interval', 'webhook', 'manual'] as const
export type TriggerKind = (typeof TRIGGER_KINDS)[number]

export const JOB_STATUSES = ['active', 'paused', 'archived'] as const

const cronTriggerInput = z.object({
  triggerKind: z.literal('cron'),
  cronExpression: cronSchema,
  triggerTimezone: tzSchema,
})

const intervalTriggerInput = z.object({
  triggerKind: z.literal('interval'),
  intervalSeconds: z.int().min(1),
})

const webhookTriggerInput = z.object({
  triggerKind: z.literal('webhook'),
})

const manualTriggerInput = z.object({
  triggerKind: z.literal('manual'),
})

export const TriggerInput = z.discriminatedUnion('triggerKind', [
  cronTriggerInput,
  intervalTriggerInput,
  webhookTriggerInput,
  manualTriggerInput,
])

export type TriggerInput = z.infer<typeof TriggerInput>

const bodyTemplateField = z
  .string()
  .max(64 * 1024)
  .default('')
const headersTemplateField = z
  .string()
  .max(8 * 1024)
  .default('{}')
const maxAttemptsField = z.int().min(1).max(10).default(3)
const overallDeadlineMsField = z
  .int()
  .min(1000)
  .max(15 * 60 * 1000)
  .default(60_000)

const jobMutableFields = {
  name: nameField,
  bodyTemplate: bodyTemplateField,
  headersTemplate: headersTemplateField,
  variables: VariableMapSchema.optional(),
  maxAttempts: maxAttemptsField,
  overallDeadlineMs: overallDeadlineMsField,
}

export const JobCreateInput = z
  .object({
    ...jobMutableFields,
    slug: slugField,
    targetSlug: slugField,
    trigger: TriggerInput,
  })
  .meta({ id: 'JobCreateInput' })

export type JobCreateInput = z.infer<typeof JobCreateInput>

export const JobUpdateInput = z
  .object({
    ...jobMutableFields,
    targetSlug: slugField,
    trigger: TriggerInput,
  })
  .meta({ id: 'JobUpdateInput' })

export type JobUpdateInput = z.infer<typeof JobUpdateInput>

export const JobSchema = z
  .object({
    id: z.string(),
    workspaceId: z.string(),
    workspaceSlug: z.string(),
    workspaceName: z.string(),
    workspaceTimezone: tzSchema,
    targetId: z.string(),
    targetSlug: z.string(),
    targetName: z.string(),
    name: z.string(),
    slug: z.string(),
    triggerKind: z.enum(TRIGGER_KINDS),
    cronExpression: z.string().nullable(),
    intervalSeconds: z.int().nullable(),
    triggerTimezone: z.string().nullable(),
    bodyTemplate: z.string(),
    headersTemplate: z.string(),
    variables: VariableMapSchema,
    maxAttempts: z.int(),
    overallDeadlineMs: z.int(),
    lastFireAt: z.iso.datetime().nullable(),
    nextFireAt: z.iso.datetime().nullable(),
    status: z.enum(JOB_STATUSES),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .meta({
    id: 'Job',
    description: 'A scheduled HTTP call owned by a Workspace.',
  })

export type Job = z.infer<typeof JobSchema>

export const JobSummarySchema = z
  .object({
    id: z.string(),
    slug: z.string(),
    name: z.string(),
    targetSlug: z.string(),
    targetName: z.string(),
    workspaceSlug: z.string(),
    workspaceName: z.string(),
    triggerKind: z.enum(TRIGGER_KINDS),
    cronExpression: z.string().nullable(),
    intervalSeconds: z.int().nullable(),
    triggerTimezone: z.string().nullable(),
    workspaceTimezone: tzSchema,
    nextFireAt: z.iso.datetime().nullable(),
    lastFireAt: z.iso.datetime().nullable(),
    status: z.enum(JOB_STATUSES),
    lastRunOutcome: z.enum(['success', 'failure', 'timeout']).nullable(),
    lastRunStartedAt: z.iso.datetime().nullable(),
  })
  .meta({ id: 'JobSummary' })

export type JobSummary = z.infer<typeof JobSummarySchema>
