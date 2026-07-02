import { describe, expect, it } from 'vitest'
import { describeCron } from './describe'

describe('describeCron', () => {
  it('describes a weekday 9am schedule', () => {
    const text = describeCron('0 9 * * 1-5')
    expect(text).toMatch(/09:00 AM/)
    expect(text).toMatch(/Monday through Friday/)
  })

  it('describes an every-2-minutes schedule from a step', () => {
    expect(describeCron('*/2 * * * *')).toMatch(/Every 2 minutes/i)
  })

  it('describes an every-2-minutes schedule from a stepped range', () => {
    expect(describeCron('1-59/2 * * * *')).toMatch(/Every 2 minutes/i)
  })

  it('describes a daily schedule', () => {
    expect(describeCron('0 0 * * *')).toMatch(/12:00 AM/)
  })

  it('returns null for an unparseable expression', () => {
    expect(describeCron('not a cron')).toBeNull()
  })
})
