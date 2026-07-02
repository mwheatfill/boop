import { describe, expect, it } from 'vitest'
import { isFiveFieldCron } from './validate'

describe('isFiveFieldCron', () => {
  it('accepts standard 5-field expressions', () => {
    expect(isFiveFieldCron('0 15,21 * * 0#3')).toBe(true)
    expect(isFiveFieldCron('0 9 * * 1-5')).toBe(true)
    expect(isFiveFieldCron('*/5 * * * *')).toBe(true)
  })

  it('rejects a 6-field (seconds) expression', () => {
    expect(isFiveFieldCron('0 15 15 ? * 1#3')).toBe(false)
  })

  it('rejects too few fields', () => {
    expect(isFiveFieldCron('0 9 * *')).toBe(false)
  })

  it('tolerates surrounding and repeated whitespace', () => {
    expect(isFiveFieldCron('  0   9  *  *  1-5  ')).toBe(true)
  })
})
