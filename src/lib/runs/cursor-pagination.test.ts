import { describe, expect, it } from 'vitest'
import {
  buildWhere,
  cursorCondition,
  encodeCursor,
  parseCursor,
  type RunCursor,
} from './cursor-pagination'

const sampleCursor: RunCursor = {
  startedAt: new Date('2026-05-12T15:30:00.000Z'),
  id: 'run_abc123',
}

describe('encodeCursor / parseCursor', () => {
  it('round-trips an arbitrary (Date, id) pair', () => {
    const encoded = encodeCursor(sampleCursor)
    const decoded = parseCursor(encoded)
    expect(decoded).not.toBeNull()
    expect(decoded?.id).toBe(sampleCursor.id)
    expect(decoded?.startedAt.toISOString()).toBe(sampleCursor.startedAt.toISOString())
  })

  it('produces an opaque base64url string (no padding, no + or /)', () => {
    const encoded = encodeCursor(sampleCursor)
    expect(encoded).not.toMatch(/[=+/]/)
  })

  it('returns null for malformed input', () => {
    expect(parseCursor('not a cursor')).toBeNull()
    expect(parseCursor('')).toBeNull()
    expect(parseCursor(undefined)).toBeNull()
  })

  it('returns null when the encoded payload has no separator', () => {
    const bad = btoa('no-pipe-here').replace(/=+$/, '')
    expect(parseCursor(bad)).toBeNull()
  })

  it('returns null when the ISO timestamp is invalid', () => {
    const bad = btoa('not-iso|run_x').replace(/=+$/, '')
    expect(parseCursor(bad)).toBeNull()
  })

  it('round-trips an id containing a pipe character', () => {
    const tricky: RunCursor = { startedAt: sampleCursor.startedAt, id: 'run_a|b|c' }
    const decoded = parseCursor(encodeCursor(tricky))
    expect(decoded?.id).toBe('run_a|b|c')
  })
})

describe('cursorCondition', () => {
  it('returns undefined for a null cursor', () => {
    expect(cursorCondition(null)).toBeUndefined()
  })

  it('returns a SQL fragment for a non-null cursor', () => {
    const result = cursorCondition(sampleCursor)
    expect(result).toBeDefined()
  })
})

describe('buildWhere', () => {
  it('returns undefined for null cursor and no extra conditions', () => {
    expect(buildWhere(null)).toBeUndefined()
  })

  it('returns just the cursor predicate when no extra conditions', () => {
    const result = buildWhere(sampleCursor)
    expect(result).toBeDefined()
  })

  it('AND-composes the cursor with extra conditions', () => {
    const dummyCondition = cursorCondition(sampleCursor)
    const combined = buildWhere(sampleCursor, dummyCondition)
    expect(combined).toBeDefined()
  })

  it('skips undefined conditions cleanly', () => {
    const result = buildWhere(null, undefined, undefined)
    expect(result).toBeUndefined()
  })
})
