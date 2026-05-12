import { Cron } from 'croner'
import { z } from './openapi'

const validityCache = new Map<string, boolean>()

function isValidCron(expr: string): boolean {
  const cached = validityCache.get(expr)
  if (cached !== undefined) return cached
  let valid = false
  if (expr.trim().split(/\s+/).length === 5) {
    try {
      new Cron(expr)
      valid = true
    } catch {
      valid = false
    }
  }
  validityCache.set(expr, valid)
  return valid
}

export const cronSchema = z
  .string()
  .refine(isValidCron, {
    message: 'Must be a 5-field cron expression (minute hour day-of-month month day-of-week)',
  })
  .meta({
    id: 'CronExpression',
    description:
      'Five-field cron expression with one-minute granularity. Seconds and year fields not supported.',
    example: '0 9 * * MON-FRI',
  })

export type CronExpression = z.infer<typeof cronSchema>
