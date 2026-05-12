import { describe, expect, it } from 'vitest'
import {
  CURATED_TIMEZONES,
  describeTimezone,
  formatTimezoneClock,
  formatTimezoneOffset,
  listAllTimezones,
} from './timezone-display'

describe('describeTimezone', () => {
  it('returns the curated label for a curated zone', () => {
    const phoenix = describeTimezone('America/Phoenix')
    expect(phoenix.city).toBe('Phoenix')
    expect(phoenix.region).toBe('US Arizona')
  })

  it('derives a label from the IANA path for an uncurated zone', () => {
    const london = describeTimezone('Europe/London')
    expect(london.city).toBe('London')
    expect(london.region).toBe('Europe')
  })

  it('humanizes underscores in derived city names', () => {
    const ny = describeTimezone('America/Indiana/Indianapolis')
    expect(ny.city).toBe('Indianapolis')
  })
})

describe('formatTimezoneOffset', () => {
  it('returns a UTC-rooted label for the UTC zone', () => {
    expect(formatTimezoneOffset('UTC')).toMatch(/^UTC/)
  })

  it('returns a UTC±N for named zones', () => {
    expect(formatTimezoneOffset('America/Phoenix')).toMatch(/^UTC[+-]\d/)
  })

  it('returns empty string for an unknown zone', () => {
    expect(formatTimezoneOffset('Not/A/Real_Zone')).toBe('')
  })
})

describe('formatTimezoneClock', () => {
  it('formats HH:mm in 24-hour for a known zone', () => {
    const value = formatTimezoneClock('UTC', new Date('2026-05-12T14:32:00Z'))
    expect(value).toBe('14:32')
  })

  it('returns empty for an unknown zone', () => {
    expect(formatTimezoneClock('Not/A/Real_Zone')).toBe('')
  })
})

describe('listAllTimezones', () => {
  it('includes the curated zones', () => {
    const zones = listAllTimezones()
    for (const curated of CURATED_TIMEZONES) {
      if (curated.iana === 'UTC') continue
      expect(zones).toContain(curated.iana)
    }
  })
})
