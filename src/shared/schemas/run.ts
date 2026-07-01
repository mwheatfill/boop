import { z } from './openapi'

export const RUN_STATUSES = ['scheduled', 'running', 'completed', 'canceled'] as const
export const RUN_OUTCOMES = ['success', 'failure', 'timeout'] as const
export const FAILURE_KINDS = [
  'timeout',
  'network',
  'http_4xx',
  'http_5xx',
  'non_2xx_other',
  'tunnel_credential_missing',
] as const
export type RunOutcome = (typeof RUN_OUTCOMES)[number]
export type FailureKind = (typeof FAILURE_KINDS)[number]
export const TRIGGER_SOURCES = ['cron', 'interval', 'webhook', 'manual'] as const
export const DISPLAY_OUTCOMES = [
  'success',
  'failure',
  'timeout',
  'skipped',
  'running',
  'scheduled',
] as const

export const TriggerSourceSchema = z.enum(TRIGGER_SOURCES).meta({ id: 'TriggerSource' })
export type TriggerSource = z.infer<typeof TriggerSourceSchema>

export const RedactedHeadersSchema = z
  .record(z.string(), z.string())
  .meta({ id: 'RedactedHeaders' })

export const RunSchema = z
  .object({
    id: z.string(),
    jobId: z.string(),
    workspaceId: z.string(),
    scheduledAt: z.iso.datetime(),
    startedAt: z.iso.datetime().nullable(),
    completedAt: z.iso.datetime().nullable(),
    status: z.enum(RUN_STATUSES),
    outcome: z.enum(RUN_OUTCOMES).nullable(),
    triggerSource: TriggerSourceSchema,
    skippedReason: z.string().nullable(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .meta({ id: 'Run' })

export type Run = z.infer<typeof RunSchema>

export const AttemptSummarySchema = z
  .object({
    id: z.string(),
    runId: z.string(),
    attemptNumber: z.int(),
    startedAt: z.iso.datetime(),
    completedAt: z.iso.datetime().nullable(),
    httpStatus: z.int().nullable(),
    failureKind: z.enum(FAILURE_KINDS).nullable(),
  })
  .meta({ id: 'AttemptSummary' })

export type AttemptSummary = z.infer<typeof AttemptSummarySchema>

export const AttemptDetailSchema = AttemptSummarySchema.extend({
  requestBodyR2Key: z.string().nullable(),
  responseBodyR2Key: z.string().nullable(),
  requestHeaders: RedactedHeadersSchema.nullable(),
}).meta({ id: 'AttemptDetail' })

export type AttemptDetail = z.infer<typeof AttemptDetailSchema>

export const RunDetailResponseSchema = z
  .object({
    run: RunSchema,
    job: z.object({
      id: z.string(),
      slug: z.string(),
      name: z.string(),
      status: z.enum(['active', 'paused', 'archived']),
    }),
    workspace: z.object({
      id: z.string(),
      slug: z.string(),
      name: z.string(),
      timezone: z.string(),
    }),
    target: z.object({
      id: z.string(),
      slug: z.string(),
      name: z.string(),
      url: z.string(),
      method: z.string(),
    }),
    attempts: z.array(AttemptDetailSchema),
    displayOutcome: z.enum(DISPLAY_OUTCOMES),
  })
  .meta({ id: 'RunDetailResponse' })

export type RunDetailResponse = z.infer<typeof RunDetailResponseSchema>

export const RunSummaryRowSchema = z
  .object({
    id: z.string(),
    jobId: z.string(),
    jobSlug: z.string(),
    jobName: z.string(),
    workspaceId: z.string(),
    workspaceSlug: z.string(),
    workspaceName: z.string(),
    startedAt: z.iso.datetime().nullable(),
    completedAt: z.iso.datetime().nullable(),
    durationMs: z.int().nullable(),
    status: z.enum(RUN_STATUSES),
    outcome: z.enum(RUN_OUTCOMES).nullable(),
    triggerSource: TriggerSourceSchema,
    displayOutcome: z.enum(DISPLAY_OUTCOMES),
  })
  .meta({ id: 'RunSummaryRow' })

export type RunSummaryRow = z.infer<typeof RunSummaryRowSchema>

export const RunsListResponseSchema = z
  .object({
    rows: z.array(RunSummaryRowSchema),
    nextCursor: z.string().nullable(),
  })
  .meta({ id: 'RunsListResponse' })

export type RunsListResponse = z.infer<typeof RunsListResponseSchema>

export const RunsForJobInput = z
  .object({
    jobId: z.string().min(1),
    cursor: z.string().optional(),
    limit: z.int().min(1).max(100).optional(),
  })
  .meta({
    id: 'RunsForJobInput',
    description: 'Cursor-paginated request for the runs of a single job.',
  })
export type RunsForJobInput = z.infer<typeof RunsForJobInput>

export const RunRef = z
  .object({
    workspaceSlug: z.string().min(1),
    jobSlug: z.string().min(1),
    runId: z.string().min(1),
  })
  .meta({ id: 'RunRef', description: 'Addresses a Run by workspace slug, job slug, and run id.' })
export type RunRef = z.infer<typeof RunRef>

export const AttemptBodyPreviewInput = z
  .object({
    attemptId: z.string().min(1),
    kind: z.enum(['request', 'response']),
  })
  .meta({
    id: 'AttemptBodyPreviewInput',
    description: 'Requests a size-capped preview of the request or response body of one attempt.',
  })
export type AttemptBodyPreviewInput = z.infer<typeof AttemptBodyPreviewInput>
