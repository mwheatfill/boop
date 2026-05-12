import { describe, expect, it } from 'vitest'
import { tzSchema } from './timezone'

describe('tzSchema', () => {
  it.each([
    'America/New_York',
    'UTC',
    'Asia/Kolkata',
    'Europe/London',
    'Pacific/Auckland',
  ])('accepts %s', (tz) => {
    expect(tzSchema.safeParse(tz).success).toBe(true)
  })

  it.each(['NYC', 'America/NewYork', '', 'GMT+5', 'Earth/Mars'])('rejects %s', (tz) => {
    expect(tzSchema.safeParse(tz).success).toBe(false)
  })

  it('rejects non-string input', () => {
    expect(tzSchema.safeParse(null).success).toBe(false)
    expect(tzSchema.safeParse(undefined).success).toBe(false)
    expect(tzSchema.safeParse(123).success).toBe(false)
  })
})
