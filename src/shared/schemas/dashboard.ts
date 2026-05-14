import { z } from './openapi'
import { tzSchema } from './timezone'

export const StatsSchema = z
  .object({
    failingJobsNow: z.int(),
    successRate24h: z.number(),
    successRate24hDelta: z.number(),
    runs24h: z.int(),
    runs24hDelta: z.int(),
    avgDurationMs24h: z.number().nullable(),
    avgDurationMs24hDelta: z.number().nullable(),
  })
  .meta({ id: 'DashboardStats' })

export type Stats = z.infer<typeof StatsSchema>

const SparklinePointSchema = z.object({ t: z.number(), v: z.number() })

export const SparklinesSchema = z
  .object({
    runs24h: z.array(SparklinePointSchema),
    avgDurationMs24h: z.array(SparklinePointSchema),
  })
  .meta({ id: 'DashboardSparklines' })

export type Sparklines = z.infer<typeof SparklinesSchema>

export const RunsDailyBucketSchema = z
  .object({
    day: z.string(),
    success: z.int(),
    failure: z.int(),
  })
  .meta({ id: 'RunsDailyBucket' })

export type RunsDailyBucket = z.infer<typeof RunsDailyBucketSchema>

export const NeedsAttentionRowSchema = z
  .object({
    customerSlug: z.string(),
    customerName: z.string(),
    jobSlug: z.string(),
    jobName: z.string(),
    status: z.enum(['paused', 'failing']),
    lastFailureAt: z.number().nullable(),
  })
  .meta({ id: 'NeedsAttentionRow' })

export type NeedsAttentionRow = z.infer<typeof NeedsAttentionRowSchema>

export const UpcomingFireRowSchema = z
  .object({
    customerSlug: z.string(),
    customerName: z.string(),
    jobSlug: z.string(),
    jobName: z.string(),
    triggerSummary: z.string(),
    nextFireAt: z.number(),
    timezone: tzSchema,
  })
  .meta({ id: 'UpcomingFireRow' })

export type UpcomingFireRow = z.infer<typeof UpcomingFireRowSchema>

export const RecentFailureRowSchema = z
  .object({
    runId: z.string(),
    customerSlug: z.string(),
    customerName: z.string(),
    jobSlug: z.string(),
    jobName: z.string(),
    outcome: z.enum(['failure', 'timeout']),
    completedAt: z.number().nullable(),
  })
  .meta({ id: 'RecentFailureRow' })

export type RecentFailureRow = z.infer<typeof RecentFailureRowSchema>

export const DashboardSummarySchema = z
  .object({
    stats: StatsSchema,
    sparklines: SparklinesSchema,
    runsSeries7d: z.array(RunsDailyBucketSchema),
    needsAttention: z.array(NeedsAttentionRowSchema),
    upcomingFires: z.array(UpcomingFireRowSchema),
    recentFailures: z.array(RecentFailureRowSchema),
  })
  .meta({ id: 'DashboardSummary' })

export type DashboardSummary = z.infer<typeof DashboardSummarySchema>
