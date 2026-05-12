import { describe, expect, it } from 'vitest'
import { nextRuns } from './next-runs'

describe('nextRuns', () => {
  it('returns the next n run dates from the anchor in the given timezone', () => {
    const runs = nextRuns({
      expression: '0 9 * * 1-5',
      timezone: 'America/New_York',
      anchor: new Date('2026-05-11T13:00:00.000Z'),
      n: 3,
    })
    expect(runs).toHaveLength(3)
    expect(runs.every((d) => d instanceof Date)).toBe(true)
    for (let i = 1; i < runs.length; i++) {
      expect((runs[i] as Date).getTime()).toBeGreaterThan((runs[i - 1] as Date).getTime())
    }
  })

  it('honors the timezone for the same expression', () => {
    const anchor = new Date('2026-05-12T14:00:00.000Z')
    const ny = nextRuns({
      expression: '0 9 * * *',
      timezone: 'America/New_York',
      anchor,
      n: 1,
    })
    const utc = nextRuns({
      expression: '0 9 * * *',
      timezone: 'UTC',
      anchor,
      n: 1,
    })
    expect((ny[0] as Date).toISOString()).not.toBe((utc[0] as Date).toISOString())
  })

  it('returns an empty array when n is zero or negative', () => {
    expect(nextRuns({ expression: '* * * * *', timezone: 'UTC', n: 0 })).toEqual([])
    expect(nextRuns({ expression: '* * * * *', timezone: 'UTC', n: -2 })).toEqual([])
  })

  it('returns n consecutive minute-by-minute runs for `* * * * *`', () => {
    const runs = nextRuns({
      expression: '* * * * *',
      timezone: 'UTC',
      anchor: new Date('2026-05-12T10:00:30.000Z'),
      n: 4,
    })
    expect(runs).toHaveLength(4)
    for (let i = 1; i < runs.length; i++) {
      expect((runs[i] as Date).getTime() - (runs[i - 1] as Date).getTime()).toBe(60_000)
    }
  })

  it('throws on a malformed expression', () => {
    expect(() => nextRuns({ expression: 'not a cron', timezone: 'UTC', n: 1 })).toThrow()
  })
})
