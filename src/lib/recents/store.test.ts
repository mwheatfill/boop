import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { clearRecents, readRecents, visitRecent } from './store'

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  clearRecents()
})

describe('recents store', () => {
  it('returns empty array when nothing stored', () => {
    expect(readRecents()).toEqual([])
  })

  it('persists a visit', () => {
    visitRecent({
      id: 'job:acme:backup',
      entity: 'job',
      label: 'Backup',
      slug: 'backup',
      workspaceSlug: 'acme',
    })
    const r = readRecents()
    expect(r).toHaveLength(1)
    expect(r[0]?.label).toBe('Backup')
  })

  it('promotes existing entry to head without duplicating', () => {
    visitRecent({ id: 'a', entity: 'workspace', label: 'A', slug: 'a' })
    visitRecent({ id: 'b', entity: 'workspace', label: 'B', slug: 'b' })
    visitRecent({ id: 'a', entity: 'workspace', label: 'A', slug: 'a' })
    const r = readRecents()
    expect(r.map((x) => x.id)).toEqual(['a', 'b'])
  })

  it('caps at 5 entries', () => {
    for (let i = 0; i < 8; i++) {
      visitRecent({ id: `c-${i}`, entity: 'workspace', label: `C ${i}`, slug: `c-${i}` })
    }
    const r = readRecents()
    expect(r).toHaveLength(5)
    expect(r[0]?.id).toBe('c-7')
    expect(r[4]?.id).toBe('c-3')
  })

  it('tolerates malformed storage', () => {
    localStorage.setItem('boop.recents', 'not json')
    expect(readRecents()).toEqual([])
  })
})
