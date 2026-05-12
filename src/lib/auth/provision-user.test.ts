import { describe, expect, it } from 'vitest'
import { users } from '@/lib/db/schema'
import { createTestDb } from '@/lib/db/test-db'
import { provisionUser } from './provision-user'

describe('provisionUser', () => {
  it('promotes the first user to admin', async () => {
    const db = createTestDb()
    const user = await provisionUser(db, { email: 'first@switchthink.com', name: 'First' })
    expect(user.role).toBe('admin')
    expect(user.email).toBe('first@switchthink.com')
    expect(user.name).toBe('First')
    expect(user.id).toMatch(/^usr_/)
  })

  it('assigns operator to subsequent users', async () => {
    const db = createTestDb()
    await provisionUser(db, { email: 'first@switchthink.com' })
    const second = await provisionUser(db, { email: 'second@switchthink.com' })
    expect(second.role).toBe('operator')
  })

  it('is idempotent on the same email and refreshes name/image without changing role', async () => {
    const db = createTestDb()
    const initial = await provisionUser(db, { email: 'a@x.com', name: 'A' })
    expect(initial.role).toBe('admin')
    const repeat = await provisionUser(db, { email: 'a@x.com', name: 'A renamed' })
    expect(repeat.id).toBe(initial.id)
    expect(repeat.role).toBe('admin')
    expect(repeat.name).toBe('A renamed')
    const allUsers = await db.select().from(users)
    expect(allUsers).toHaveLength(1)
  })

  it('handles three sequential first-sight inserts: one admin, two operators', async () => {
    const db = createTestDb()
    const a = await provisionUser(db, { email: 'a@x.com' })
    const b = await provisionUser(db, { email: 'b@x.com' })
    const c = await provisionUser(db, { email: 'c@x.com' })
    const roles = [a.role, b.role, c.role].sort()
    expect(roles).toEqual(['admin', 'operator', 'operator'])
  })

  it('drops null name and image fields from the returned User', async () => {
    const db = createTestDb()
    const user = await provisionUser(db, { email: 'noname@x.com' })
    expect(user).not.toHaveProperty('name')
    expect(user).not.toHaveProperty('image')
  })
})
