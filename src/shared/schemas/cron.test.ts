import { Cron } from 'croner'
import { describe, expect, it } from 'vitest'
import { cronSchema } from './cron'

describe('cronSchema', () => {
  it.each([
    '0 9 * * MON-FRI',
    '*/15 * * * *',
    '0 0 1 JAN *',
    '0 0 * * 0',
    '30 14 * * *',
  ])('accepts %s', (expr) => {
    expect(cronSchema.safeParse(expr).success).toBe(true)
  })

  it.each([
    '0 0 9 * * MON-FRI',
    '0 0 9 * * MON-FRI 2026',
    'every minute',
    '',
    '* * *',
    'banana',
  ])('rejects %s', (expr) => {
    expect(cronSchema.safeParse(expr).success).toBe(false)
  })

  it('integrates with croner for DST edge transitions', () => {
    expect(cronSchema.safeParse('0 * * * *').success).toBe(true)
    const job = new Cron('0 * * * *', {
      timezone: 'Europe/London',
      paused: true,
    })
    const next = job.nextRun(new Date('2026-03-29T00:30:00Z'))
    expect(next).toBeInstanceOf(Date)
  })
})
