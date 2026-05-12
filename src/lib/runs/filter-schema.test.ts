import { describe, expect, it } from 'vitest'
import { filtersToWhere, RunsSearchSchema, resolveRange } from './filter-schema'

describe('RunsSearchSchema', () => {
  it('falls back to the 24h range with no input', () => {
    const result = RunsSearchSchema.parse({})
    expect(result.range).toBe('24h')
    expect(result.customer).toBeUndefined()
    expect(result.status).toBeUndefined()
  })

  it('catches a malformed range and falls back to 24h', () => {
    const result = RunsSearchSchema.parse({ range: 'forever' })
    expect(result.range).toBe('24h')
  })

  it('parses a CSV string of statuses into an enum array', () => {
    const result = RunsSearchSchema.parse({ status: 'running,completed' })
    expect(result.status).toEqual(['running', 'completed'])
  })

  it('drops unknown values from a CSV status string', () => {
    const result = RunsSearchSchema.parse({ status: 'running,nope,completed' })
    expect(result.status).toEqual(['running', 'completed'])
  })

  it('accepts an array form for status', () => {
    const result = RunsSearchSchema.parse({ status: ['running'] })
    expect(result.status).toEqual(['running'])
  })

  it('accepts CSV customer slugs and trims whitespace', () => {
    const result = RunsSearchSchema.parse({ customer: 'acme, beta' })
    expect(result.customer).toEqual(['acme', 'beta'])
  })

  it('passes through a valid ISO datetime in from/to', () => {
    const result = RunsSearchSchema.parse({
      range: 'custom',
      from: '2026-05-01T00:00:00.000Z',
      to: '2026-05-12T23:59:59.999Z',
    })
    expect(result.from).toBe('2026-05-01T00:00:00.000Z')
    expect(result.to).toBe('2026-05-12T23:59:59.999Z')
  })

  it('catches a malformed ISO datetime and falls back to empty', () => {
    const result = RunsSearchSchema.parse({ range: 'custom', from: 'not-a-date' })
    expect(result.from).toBe('')
  })
})

describe('resolveRange', () => {
  const now = new Date('2026-05-12T15:00:00.000Z')

  it('resolves 24h to now - 24h with no upper bound', () => {
    const filters = RunsSearchSchema.parse({})
    const range = resolveRange(filters, now)
    expect(range.from?.toISOString()).toBe('2026-05-11T15:00:00.000Z')
    expect(range.to).toBeUndefined()
  })

  it('resolves 7d to now - 7 days', () => {
    const filters = RunsSearchSchema.parse({ range: '7d' })
    const range = resolveRange(filters, now)
    expect(range.from?.toISOString()).toBe('2026-05-05T15:00:00.000Z')
  })

  it('resolves custom to the literal from/to', () => {
    const filters = RunsSearchSchema.parse({
      range: 'custom',
      from: '2026-05-01T00:00:00.000Z',
      to: '2026-05-10T00:00:00.000Z',
    })
    const range = resolveRange(filters, now)
    expect(range.from?.toISOString()).toBe('2026-05-01T00:00:00.000Z')
    expect(range.to?.toISOString()).toBe('2026-05-10T00:00:00.000Z')
  })

  it('returns empty bounds for custom range with no from/to', () => {
    const filters = RunsSearchSchema.parse({ range: 'custom' })
    const range = resolveRange(filters, now)
    expect(range.from).toBeUndefined()
    expect(range.to).toBeUndefined()
  })
})

describe('filtersToWhere', () => {
  const now = new Date('2026-05-12T15:00:00.000Z')

  it('returns a non-undefined fragment for the default (24h range)', () => {
    const filters = RunsSearchSchema.parse({})
    expect(filtersToWhere(filters, now)).toBeDefined()
  })

  it('returns undefined for custom range with no bounds and no other filters', () => {
    const filters = RunsSearchSchema.parse({ range: 'custom' })
    expect(filtersToWhere(filters, now)).toBeUndefined()
  })

  it('produces a fragment when status is set', () => {
    const filters = RunsSearchSchema.parse({ range: 'custom', status: 'running' })
    expect(filtersToWhere(filters, now)).toBeDefined()
  })

  it('produces a fragment when failureKind is set (EXISTS subquery)', () => {
    const filters = RunsSearchSchema.parse({
      range: 'custom',
      outcome: 'failure',
      failureKind: 'http_5xx',
    })
    expect(filtersToWhere(filters, now)).toBeDefined()
  })
})
