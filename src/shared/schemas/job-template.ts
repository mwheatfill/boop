import { nameField, slugField } from './fields'
import { z } from './openapi'
import { tzSchema } from './timezone'
import { VariableMapSchema } from './workspace-variables'

export const JOB_TEMPLATE_TAGS = [
  'backups',
  'health-checks',
  'reports',
  'integrations',
  'maintenance',
  'custom',
] as const
export const JOB_TEMPLATE_STATUSES = ['active', 'archived'] as const

export type JobTemplateTag = (typeof JOB_TEMPLATE_TAGS)[number]

const triggerConfigSchema = z
  .object({
    cronExpression: z.string().optional(),
    triggerTimezone: tzSchema.optional(),
    intervalSeconds: z.int().min(1).optional(),
  })
  .default({})

const captureFieldsSchema = z
  .object({
    bodyTemplate: z.boolean().default(true),
    headersTemplate: z.boolean().default(true),
    variables: z.boolean().default(true),
    maxAttempts: z.boolean().default(true),
    overallDeadlineMs: z.boolean().default(true),
  })
  .default({
    bodyTemplate: true,
    headersTemplate: true,
    variables: true,
    maxAttempts: true,
    overallDeadlineMs: true,
  })

const templateMutableFields = {
  name: nameField,
  tag: z.enum(JOB_TEMPLATE_TAGS).default('custom'),
  icon: z.string().trim().min(1).max(64).optional(),
  description: z.string().trim().max(240).optional(),
  triggerKind: z.enum(['cron', 'interval', 'webhook']),
  triggerConfig: triggerConfigSchema,
  targetRef: z.string().trim().min(1).max(128),
  bodyTemplate: z
    .string()
    .max(64 * 1024)
    .default(''),
  headersTemplate: z
    .string()
    .max(8 * 1024)
    .default('{}'),
  variables: VariableMapSchema.default({}),
  maxAttempts: z.int().min(1).max(10).default(3),
  overallDeadlineMs: z
    .int()
    .min(1000)
    .max(15 * 60 * 1000)
    .default(60_000),
}

export const JobTemplateSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    slug: z.string(),
    workspaceId: z.string().nullable(),
    workspaceSlug: z.string().nullable(),
    workspaceName: z.string().nullable(),
    tag: z.enum(JOB_TEMPLATE_TAGS),
    icon: z.string().nullable(),
    description: z.string().nullable(),
    triggerKind: z.enum(['cron', 'interval', 'webhook']),
    triggerConfig: triggerConfigSchema,
    targetRef: z.string(),
    bodyTemplate: z.string(),
    headersTemplate: z.string(),
    variables: VariableMapSchema,
    maxAttempts: z.int(),
    overallDeadlineMs: z.int(),
    builtIn: z.boolean(),
    status: z.enum(JOB_TEMPLATE_STATUSES),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
    archivedAt: z.iso.datetime().nullable(),
  })
  .meta({
    id: 'JobTemplate',
    description: 'A clone-on-create seed for a Job.',
  })

export type JobTemplate = z.infer<typeof JobTemplateSchema>

export const JobTemplateCreateInput = z
  .object({
    ...templateMutableFields,
    slug: slugField,
    workspaceSlug: slugField.optional(),
  })
  .meta({ id: 'JobTemplateCreateInput' })

export type JobTemplateCreateInput = z.infer<typeof JobTemplateCreateInput>

export const JobTemplateUpdateInput = z
  .object({
    ...templateMutableFields,
  })
  .meta({ id: 'JobTemplateUpdateInput' })

export type JobTemplateUpdateInput = z.infer<typeof JobTemplateUpdateInput>

export const JobTemplateSaveFromJobInput = z
  .object({
    workspaceSlug: slugField,
    jobSlug: slugField,
    name: nameField,
    slug: slugField,
    tag: z.enum(JOB_TEMPLATE_TAGS).default('custom'),
    description: z.string().trim().max(240).optional(),
    capture: captureFieldsSchema,
  })
  .meta({ id: 'JobTemplateSaveFromJobInput' })

export type JobTemplateSaveFromJobInput = z.infer<typeof JobTemplateSaveFromJobInput>
