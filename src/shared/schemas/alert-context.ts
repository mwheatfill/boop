import { z } from './openapi'

const RunAlertContextSchema = z.object({
  kind: z.literal('run'),
  customer_name: z.string(),
  customer_slug: z.string(),
  job_name: z.string(),
  job_slug: z.string(),
  target_name: z.string(),
  target_url: z.string(),
  run_id: z.string(),
  run_url: z.string(),
  outcome: z.string(),
  started_at: z.string(),
  completed_at: z.string(),
  duration_ms: z.int(),
  attempt_count: z.int(),
  trigger_source: z.string(),
  failure_kind: z.string().nullable(),
  rule_name: z.string(),
  rule_kind: z.string(),
  test: z.boolean(),
})

const MissedAlertContextSchema = z.object({
  kind: z.literal('missed'),
  customer_name: z.string(),
  customer_slug: z.string(),
  job_name: z.string(),
  job_slug: z.string(),
  job_url: z.string(),
  rule_name: z.string(),
  rule_kind: z.literal('missed_schedule'),
  last_run_at: z.string().nullable(),
  silence_threshold_minutes: z.int(),
  trigger_source: z.string(),
  schedule: z.string(),
  test: z.boolean(),
})

export const AlertContextSchema = z
  .discriminatedUnion('kind', [RunAlertContextSchema, MissedAlertContextSchema])
  .meta({
    id: 'AlertContext',
    description: 'Synthetic context handed to Channel adapters for template rendering.',
  })

export type AlertContext = z.infer<typeof AlertContextSchema>
