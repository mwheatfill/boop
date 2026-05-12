import { Cron } from 'croner'

interface NextRunsInput {
  expression: string
  timezone: string
  anchor?: Date
  n: number
}

export function nextRuns({ expression, timezone, anchor, n }: NextRunsInput): Date[] {
  if (n <= 0) return []
  const job = new Cron(expression, { timezone })
  return job.nextRuns(n, anchor)
}
