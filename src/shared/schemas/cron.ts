import { Cron } from 'croner'
import { z } from './openapi'

export const cronSchema = z
  .string()
  .refine(
    (expr) => {
      if (expr.trim().split(/\s+/).length !== 5) return false
      try {
        new Cron(expr)
        return true
      } catch {
        return false
      }
    },
    {
      message: 'Must be a 5-field cron expression (minute hour day-of-month month day-of-week)',
    },
  )
  .meta({
    id: 'CronExpression',
    description:
      'Five-field cron expression with one-minute granularity. Seconds and year fields not supported.',
    example: '0 9 * * MON-FRI',
  })

export type CronExpression = z.infer<typeof cronSchema>
