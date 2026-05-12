import { describe, expect, it } from 'vitest'
import { createTestDb } from '@/lib/db/test-db'
import { createCustomer } from './commands'
import { getOrgTimezone } from './queries'

describe('getOrgTimezone', () => {
  it("returns the SwitchThink Customer's timezone when slug 'switchthink' exists", async () => {
    const db = createTestDb()
    await createCustomer(db, { name: 'Other', slug: 'other', timezone: 'America/New_York' })
    await createCustomer(db, {
      name: 'SwitchThink',
      slug: 'switchthink',
      timezone: 'America/Phoenix',
    })
    expect(await getOrgTimezone(db)).toBe('America/Phoenix')
  })

  it('falls back to the earliest-created Customer when slug "switchthink" is missing', async () => {
    const db = createTestDb()
    await createCustomer(db, { name: 'First', slug: 'first', timezone: 'America/Chicago' })
    await createCustomer(db, { name: 'Second', slug: 'second', timezone: 'America/Los_Angeles' })
    expect(await getOrgTimezone(db)).toBe('America/Chicago')
  })

  it('falls back to America/Phoenix when no Customers exist', async () => {
    const db = createTestDb()
    expect(await getOrgTimezone(db)).toBe('America/Phoenix')
  })
})
