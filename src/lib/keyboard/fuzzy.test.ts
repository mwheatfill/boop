import { describe, expect, it } from 'vitest'
import { fuzzyScore } from './fuzzy'

describe('fuzzyScore', () => {
  it('returns 1 for empty search', () => {
    expect(fuzzyScore('Backup', '')).toBe(1)
    expect(fuzzyScore('Backup', '   ')).toBe(1)
  })

  it('exact match outranks prefix match outranks substring match', () => {
    const exact = fuzzyScore('backup', 'backup')
    const prefix = fuzzyScore('backup nightly', 'backup')
    const substring = fuzzyScore('nightly backup', 'backup')
    expect(exact).toBeGreaterThan(prefix)
    expect(prefix).toBeGreaterThan(substring)
    expect(substring).toBeGreaterThan(0)
  })

  it('acronym match falls between prefix and substring', () => {
    const acronym = fuzzyScore('Daily Backup Nightly', 'dbn')
    const substring = fuzzyScore('nightly daily backup nightly', 'daily backup')
    expect(acronym).toBeGreaterThan(0)
    expect(acronym).toBeGreaterThan(substring)
  })

  it('returns 0 when no match', () => {
    expect(fuzzyScore('backup', 'xyz')).toBe(0)
  })

  it('matches scattered characters in order', () => {
    expect(fuzzyScore('database backup', 'dabu')).toBeGreaterThan(0)
  })

  it('keywords contribute when value misses', () => {
    expect(fuzzyScore('Run now', 'execute', ['execute', 'trigger'])).toBeGreaterThan(0)
  })

  it('case-insensitive', () => {
    expect(fuzzyScore('Backup', 'BACKUP')).toBe(1)
    expect(fuzzyScore('BACKUP', 'backup')).toBe(1)
  })
})
