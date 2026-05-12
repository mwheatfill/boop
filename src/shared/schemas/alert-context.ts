import { z } from './openapi'

export const AlertContextSchema = z
  .object({
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
  .meta({
    id: 'AlertContext',
    description: 'Synthetic context handed to Channel adapters for template rendering.',
  })

export type AlertContext = z.infer<typeof AlertContextSchema>
