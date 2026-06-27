import { describe, expect, it } from 'vitest'
import { createTestDb } from '@/lib/db/test-db'
import { createWorkspace } from './commands'
import { getOrgTimezone } from './queries'

describe('getOrgTimezone', () => {
  it('returns the earliest-created Workspace timezone regardless of slug', async () => {
    const db = createTestDb()
    await createWorkspace(db, { name: 'Other', slug: 'other', timezone: 'America/New_York' })
    await createWorkspace(db, {
      name: 'SwitchThink',
      slug: 'switchthink',
      timezone: 'America/Phoenix',
    })
    expect(await getOrgTimezone(db)).toBe('America/New_York')
  })

  it('falls back to the earliest-created Workspace', async () => {
    const db = createTestDb()
    await createWorkspace(db, { name: 'First', slug: 'first', timezone: 'America/Chicago' })
    await createWorkspace(db, { name: 'Second', slug: 'second', timezone: 'America/Los_Angeles' })
    expect(await getOrgTimezone(db)).toBe('America/Chicago')
  })

  it('falls back to America/Phoenix when no Workspaces exist', async () => {
    const db = createTestDb()
    expect(await getOrgTimezone(db)).toBe('America/Phoenix')
  })
})
