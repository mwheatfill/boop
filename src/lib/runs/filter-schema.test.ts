import { describe, expect, it } from 'vitest'
import { filtersToWhere, RunsSearchSchema, resolveRange } from './filter-schema'

describe('RunsSearchSchema', () => {
  it('falls back to the 24h range with no input', () => {
    const result = RunsSearchSchema.parse({})
    expect(result.range).toBe('24h')
    expect(result.workspace).toBeUndefined()
    expect(result.status).toBeUndefined()
  })

  it('catches a malformed range and falls back to 24h', () => {
    expect(RunsSearchSchema.parse({ range: 'forever' }).range).toBe('24h')
  })

  it('accepts a relative custom range like 45m', () => {
    expect(RunsSearchSchema.parse({ range: '45m' }).range).toBe('45m')
    expect(RunsSearchSchema.parse({ range: '3mo' }).range).toBe('3mo')
  })

  it('accepts "all"', () => {
    expect(RunsSearchSchema.parse({ range: 'all' }).range).toBe('all')
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

  it('accepts CSV workspace slugs and trims whitespace', () => {
    const result = RunsSearchSchema.parse({ workspace: 'acme, beta' })
    expect(result.workspace).toEqual(['acme', 'beta'])
  })
})

describe('resolveRange', () => {
  const now = new Date('2026-05-12T15:00:00.000Z')

  it('resolves 24h to now - 24h', () => {
    const range = resolveRange(RunsSearchSchema.parse({}), now)
    expect(range.from?.toISOString()).toBe('2026-05-11T15:00:00.000Z')
  })

  it('resolves 7d to now - 7 days', () => {
    const range = resolveRange(RunsSearchSchema.parse({ range: '7d' }), now)
    expect(range.from?.toISOString()).toBe('2026-05-05T15:00:00.000Z')
  })

  it('resolves a relative custom range (45m)', () => {
    const range = resolveRange(RunsSearchSchema.parse({ range: '45m' }), now)
    expect(range.from?.toISOString()).toBe('2026-05-12T14:15:00.000Z')
  })

  it('resolves "all" to no lower bound', () => {
    expect(resolveRange(RunsSearchSchema.parse({ range: 'all' }), now).from).toBeUndefined()
  })
})

describe('filtersToWhere', () => {
  const now = new Date('2026-05-12T15:00:00.000Z')

  it('returns a non-undefined fragment for the default (24h range)', () => {
    expect(filtersToWhere(RunsSearchSchema.parse({}), now)).toBeDefined()
  })

  it('returns undefined for range=all with no other filters', () => {
    expect(filtersToWhere(RunsSearchSchema.parse({ range: 'all' }), now)).toBeUndefined()
  })

  it('produces a fragment when status is set', () => {
    const filters = RunsSearchSchema.parse({ range: 'all', status: 'running' })
    expect(filtersToWhere(filters, now)).toBeDefined()
  })

  it('produces a fragment when failureKind is set (EXISTS subquery)', () => {
    const filters = RunsSearchSchema.parse({
      range: 'all',
      outcome: 'failure',
      failureKind: 'http_5xx',
    })
    expect(filtersToWhere(filters, now)).toBeDefined()
  })
})
