import { eq, sql } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { newId } from '@/lib/db/ids'
import { customers, jobs, runs, users } from '@/lib/db/schema'
import { createTestDb } from '@/lib/db/test-db'
import { cleanupDemoData } from './cleanup'
import { SEED_TAG } from './constants'
import { seedDemoData } from './seed'

const FIXED_NOW = new Date('2026-05-12T12:00:00.000Z')

describe('seedDemoData — minimal profile', () => {
  it('inserts a small fixed roster and run history', async () => {
    const db = createTestDb()
    const counts = await seedDemoData(db, { profile: 'minimal', now: FIXED_NOW })

    expect(counts.customers).toBe(1)
    expect(counts.operators).toBe(6)
    expect(counts.jobs).toBe(5)
    expect(counts.runs).toBeGreaterThan(0)
    expect(counts.attempts).toBeGreaterThanOrEqual(counts.runs)

    const customerRows = await db.select().from(customers)
    expect(customerRows).toHaveLength(1)
    expect(customerRows[0]?.slug).toBe('desert-vista-cu')
    expect(customerRows[0]?.seedTag).toBe(SEED_TAG)
  })

  it('is idempotent: a second run produces the same counts and ids', async () => {
    const db = createTestDb()
    const first = await seedDemoData(db, { profile: 'minimal', now: FIXED_NOW })
    const firstIds = await db.select({ id: customers.id }).from(customers)

    const second = await seedDemoData(db, { profile: 'minimal', now: FIXED_NOW })
    const secondIds = await db.select({ id: customers.id }).from(customers)

    expect(second.customers).toBe(first.customers)
    expect(second.operators).toBe(first.operators)
    expect(secondIds.map((r) => r.id).sort()).toEqual(firstIds.map((r) => r.id).sort())
  })
})

describe('cleanupDemoData', () => {
  let db: ReturnType<typeof createTestDb>

  beforeEach(async () => {
    db = createTestDb()
    await seedDemoData(db, { profile: 'minimal', now: FIXED_NOW })
  })

  it('removes every demo customer + owned resources', async () => {
    const counts = await cleanupDemoData(db)
    expect(counts.customers).toBe(1)
    expect(counts.jobs).toBe(5)
    expect(counts.users).toBe(6)
    expect(counts.runs).toBeGreaterThan(0)

    const remainingCustomers = await db.select({ count: sql<number>`count(*)` }).from(customers)
    const remainingJobs = await db.select({ count: sql<number>`count(*)` }).from(jobs)
    const remainingRuns = await db.select({ count: sql<number>`count(*)` }).from(runs)
    expect(remainingCustomers[0]?.count).toBe(0)
    expect(remainingJobs[0]?.count).toBe(0)
    expect(remainingRuns[0]?.count).toBe(0)
  })

  it('leaves operator-created rows untouched', async () => {
    const realCustomerId = newId('cust')
    const realUserId = newId('usr')
    await db.insert(customers).values({
      id: realCustomerId,
      name: 'Real Operator Customer',
      slug: 'real-operator-customer',
      timezone: 'UTC',
      autotaskCompanyId: null,
      status: 'active',
      seedTag: null,
    })
    await db.insert(users).values({
      id: realUserId,
      email: 'real-operator@example.com',
      name: 'Real Operator',
      image: null,
      role: 'operator',
      seedTag: null,
    })

    await cleanupDemoData(db)

    const surviving = await db.select().from(customers).where(eq(customers.id, realCustomerId))
    const survivingUsers = await db.select().from(users).where(eq(users.id, realUserId))
    expect(surviving).toHaveLength(1)
    expect(survivingUsers).toHaveLength(1)
  })
})

describe('seedDemoData — demo profile boundaries', () => {
  it('demo profile generates 14 days of history', async () => {
    const db = createTestDb()
    await seedDemoData(db, { profile: 'demo', now: FIXED_NOW })
    const oldest = await db
      .select({ scheduledAt: runs.scheduledAt })
      .from(runs)
      .orderBy(runs.scheduledAt)
      .limit(1)
    expect(oldest[0]?.scheduledAt).toBeDefined()
    const ageDays = (FIXED_NOW.getTime() - (oldest[0]?.scheduledAt as Date).getTime()) / 86400_000
    expect(ageDays).toBeGreaterThan(13)
    expect(ageDays).toBeLessThan(15)
  }, 60_000)
})
