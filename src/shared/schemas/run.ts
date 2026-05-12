import { z } from './openapi'

export const RUN_STATUSES = ['scheduled', 'running', 'completed', 'canceled'] as const
export const RUN_OUTCOMES = ['success', 'failure', 'timeout'] as const
export const FAILURE_KINDS = [
  'timeout',
  'network',
  'http_4xx',
  'http_5xx',
  'non_2xx_other',
] as const

export const RunSchema = z
  .object({
    id: z.string(),
    jobId: z.string(),
    customerId: z.string(),
    scheduledAt: z.iso.datetime(),
    startedAt: z.iso.datetime().nullable(),
    completedAt: z.iso.datetime().nullable(),
    status: z.enum(RUN_STATUSES),
    outcome: z.enum(RUN_OUTCOMES).nullable(),
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
