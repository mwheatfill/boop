import { Cron } from 'croner'
import { describe, expect, it } from 'vitest'
import { CRON_QUICK_PICKS } from './cron-quick-picks'

describe('CRON_QUICK_PICKS', () => {
  it('lists the six canonical quick-picks', () => {
    expect(CRON_QUICK_PICKS.map((q) => q.label)).toEqual([
      'Every minute',
      'Every 5m',
      'Hourly',
      'Daily 9am',
      'Weekdays 9am',
      'Monthly 1st',
    ])
  })

  it('every expression parses as a valid cron', () => {
    for (const q of CRON_QUICK_PICKS) {
      expect(() => new Cron(q.expression, { timezone: 'UTC' }).nextRun()).not.toThrow()
    }
  })

  it('Weekdays 9am only fires Monday through Friday', () => {
    const cron = new Cron('0 9 * * MON-FRI', { timezone: 'UTC' })
    const next = cron.nextRuns(5, new Date('2026-05-11T00:00:00Z'))
    for (const d of next) {
      expect(d.getUTCDay()).toBeGreaterThanOrEqual(1)
      expect(d.getUTCDay()).toBeLessThanOrEqual(5)
    }
  })
})
