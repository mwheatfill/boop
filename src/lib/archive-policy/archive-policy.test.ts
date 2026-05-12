import { describe, expect, it } from 'vitest'
import { newId } from '@/lib/db/ids'
import { customers, jobs, targets } from '@/lib/db/schema'
import { createTestDb } from '@/lib/db/test-db'
import { canArchiveCustomer, canArchiveTarget } from './archive-policy'

async function seedCustomer(db: ReturnType<typeof createTestDb>) {
  const id = newId('cust')
  await db.insert(customers).values({
    id,
    name: 'Acme',
    slug: 'acme',
    timezone: 'UTC',
  })
  return id
}

async function seedTarget(db: ReturnType<typeof createTestDb>, customerId: string) {
  const id = newId('tgt')
  await db.insert(targets).values({
    id,
    customerId,
    name: 'API',
    slug: 'api',
    url: 'https://example.com',
    method: 'POST',
  })
  return id
}

async function seedJob(
  db: ReturnType<typeof createTestDb>,
  customerId: string,
  targetId: string,
  status: 'active' | 'paused' | 'archived',
  slug = `job-${status}`,
) {
  await db.insert(jobs).values({
    id: newId('job'),
    customerId,
    targetId,
    name: `Job ${status}`,
    slug,
    triggerKind: 'cron',
    cronExpression: '* * * * *',
    triggerTimezone: 'UTC',
    status,
  })
}

describe('canArchiveCustomer', () => {
  it('returns ok when the customer has no jobs', async () => {
    const db = createTestDb()
    const customerId = await seedCustomer(db)
    await expect(canArchiveCustomer(db, customerId)).resolves.toEqual({ ok: true })
  })

  it('returns ok when the customer only has archived jobs', async () => {
    const db = createTestDb()
    const customerId = await seedCustomer(db)
    const targetId = await seedTarget(db, customerId)
    await seedJob(db, customerId, targetId, 'archived')
    await expect(canArchiveCustomer(db, customerId)).resolves.toEqual({ ok: true })
  })

  it('blocks when the customer has an active job', async () => {
    const db = createTestDb()
    const customerId = await seedCustomer(db)
    const targetId = await seedTarget(db, customerId)
    await seedJob(db, customerId, targetId, 'active')
    await expect(canArchiveCustomer(db, customerId)).resolves.toEqual({
      ok: false,
      reason: 'has_active_jobs',
      blockingCount: 1,
    })
  })

  it('blocks when the customer has a paused job (paused counts as non-archived)', async () => {
    const db = createTestDb()
    const customerId = await seedCustomer(db)
    const targetId = await seedTarget(db, customerId)
    await seedJob(db, customerId, targetId, 'paused')
    await expect(canArchiveCustomer(db, customerId)).resolves.toEqual({
      ok: false,
      reason: 'has_active_jobs',
      blockingCount: 1,
    })
  })

  it('counts the blocking job total accurately', async () => {
    const db = createTestDb()
    const customerId = await seedCustomer(db)
    const targetId = await seedTarget(db, customerId)
    await seedJob(db, customerId, targetId, 'active', 'job-a')
    await seedJob(db, customerId, targetId, 'paused', 'job-b')
    await seedJob(db, customerId, targetId, 'archived', 'job-c')
    await expect(canArchiveCustomer(db, customerId)).resolves.toEqual({
      ok: false,
      reason: 'has_active_jobs',
      blockingCount: 2,
    })
  })

  it('scopes the check to the asked-about customer only', async () => {
    const db = createTestDb()
    const first = await seedCustomer(db)
    const second = newId('cust')
    await db.insert(customers).values({
      id: second,
      name: 'Beta',
      slug: 'beta',
      timezone: 'UTC',
    })
    const targetId = await seedTarget(db, first)
    await seedJob(db, first, targetId, 'active')
    await expect(canArchiveCustomer(db, second)).resolves.toEqual({ ok: true })
  })
})

describe('canArchiveTarget', () => {
  it('returns ok when the target has no jobs', async () => {
    const db = createTestDb()
    const customerId = await seedCustomer(db)
    const targetId = await seedTarget(db, customerId)
    await expect(canArchiveTarget(db, targetId)).resolves.toEqual({ ok: true })
  })

  it('returns ok when all jobs referencing the target are archived', async () => {
    const db = createTestDb()
    const customerId = await seedCustomer(db)
    const targetId = await seedTarget(db, customerId)
    await seedJob(db, customerId, targetId, 'archived')
    await expect(canArchiveTarget(db, targetId)).resolves.toEqual({ ok: true })
  })

  it('blocks when an active or paused job references the target', async () => {
    const db = createTestDb()
    const customerId = await seedCustomer(db)
    const targetId = await seedTarget(db, customerId)
    await seedJob(db, customerId, targetId, 'active', 'job-a')
    await seedJob(db, customerId, targetId, 'paused', 'job-b')
    await seedJob(db, customerId, targetId, 'archived', 'job-c')
    await expect(canArchiveTarget(db, targetId)).resolves.toEqual({
      ok: false,
      reason: 'has_active_jobs',
      blockingCount: 2,
    })
  })
})
