import { describe, expect, it } from 'vitest'
import { ID_PREFIXES, type IdPrefix, newId } from './ids'

describe('newId', () => {
  it('returns the expected prefix', () => {
    for (const prefix of ID_PREFIXES) {
      expect(newId(prefix)).toMatch(new RegExp(`^${prefix}_`))
    }
  })

  it('produces 26 chars of entropy after the prefix', () => {
    const id = newId('cust')
    const [, body] = id.split('_')
    expect(body).toHaveLength(26)
  })

  it('uses the lowercase-alphanumeric Crockford-style alphabet', () => {
    const id = newId('cust')
    const body = id.slice('cust_'.length)
    expect(body).toMatch(/^[0-9abcdefghjkmnpqrstvwxyz]+$/)
  })

  it('produces unique IDs over a high-volume loop', () => {
    const seen = new Set<string>()
    const N = 50_000
    for (let i = 0; i < N; i++) {
      seen.add(newId('run'))
    }
    expect(seen.size).toBe(N)
  })

  it('is callable with each prefix in the union', () => {
    const prefixes: IdPrefix[] = ['cust', 'usr', 'tgt', 'job', 'run', 'att', 'chn', 'rul', 'ses']
    for (const p of prefixes) {
      expect(() => newId(p)).not.toThrow()
    }
  })
})
