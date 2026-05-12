import { describe, expect, it } from 'vitest'
import { ID_PREFIXES, newId } from './ids'

describe('newId', () => {
  it.each(ID_PREFIXES)('returns the expected prefix for %s', (prefix) => {
    expect(newId(prefix)).toMatch(new RegExp(`^${prefix}_`))
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

  it('produces unique IDs', () => {
    const seen = new Set<string>()
    const N = 1000
    for (let i = 0; i < N; i++) {
      seen.add(newId('run'))
    }
    expect(seen.size).toBe(N)
  })
})
