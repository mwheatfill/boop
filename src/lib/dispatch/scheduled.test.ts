import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import type { Database } from '@/lib/db/client'
import { newId } from '@/lib/db/ids'
import { customers, jobs, targets } from '@/lib/db/schema'
import { createTestDb } from '@/lib/db/test-db'
import { type DispatchMessage, runScheduled } from './scheduled'

function createCaptureQueue(): {
  queue: Queue<DispatchMessage>
  sent: DispatchMessage[]
} {
  const sent: DispatchMessage[] = []
  const queue = {
    async send(body: DispatchMessage) {
      sent.push(body)
    },
    async sendBatch() {},
  }
  return { queue: queue as unknown as Queue<DispatchMessage>, sent }
}

async function seedCustomer(db: Database, timezone = 'UTC') {
  const customerId = newId('cust')
  await db.insert(customers).values({ id: customerId, name: 'Acme', slug: 'acme', timezone })
  return customerId
}

async function seedTarget(db: Database, customerId: string) {
  const targetId = newId('tgt')
  await db.insert(targets).values({
    id: targetId,
    customerId,
    name: 'Health',
    slug: 'health',
    url: 'https://example.test/ping',
    method: 'GET',
  })
  return targetId
}

interface CronJobOverrides {
  cron?: string
  triggerKind?: 'cron' | 'interval' | 'webhook'
  status?: 'active' | 'paused' | 'archived'
  nextFireAt?: Date | null
  lastFireAt?: Date | null
  triggerTimezone?: string
}

async function seedJob(
  db: Database,
  customerId: string,
  targetId: string,
  o: CronJobOverrides = {},
) {
  const jobId = newId('job')
  await db.insert(jobs).values({
    id: jobId,
    customerId,
    targetId,
    name: 'J',
    slug: jobId.slice(-8),
    triggerKind: o.triggerKind ?? 'cron',
    cronExpression: o.cron ?? '* * * * *',
    ...(o.nextFireAt !== undefined && { nextFireAt: o.nextFireAt }),
    ...(o.lastFireAt !== undefined && { lastFireAt: o.lastFireAt }),
    ...(o.status !== undefined && { status: o.status }),
    ...(o.triggerTimezone !== undefined && { triggerTimezone: o.triggerTimezone }),
  })
  return jobId
}

describe('runScheduled', () => {
  it('first tick on a brand-new cron Job: computes next_fire_at but does not enqueue', async () => {
    const db = createTestDb()
    const { queue, sent } = createCaptureQueue()
    const cust = await seedCustomer(db)
    const tgt = await seedTarget(db, cust)
    const jobId = await seedJob(db, cust, tgt, { cron: '* * * * *', nextFireAt: null })

    const tick = new Date('2026-05-12T14:30:00.000Z')
    const result = await runScheduled({ db, dispatchQueue: queue, now: () => tick })

    expect(result.enqueued).toBe(0)
    expect(sent).toHaveLength(0)
    const [row] = await db.select().from(jobs).where(eq(jobs.id, jobId))
    expect(row?.nextFireAt?.toISOString()).toBe('2026-05-12T14:31:00.000Z')
  })

  it('enqueues a cron Job whose next_fire_at has passed', async () => {
    const db = createTestDb()
    const { queue, sent } = createCaptureQueue()
    const cust = await seedCustomer(db)
    const tgt = await seedTarget(db, cust)
    const past = new Date('2026-05-12T14:29:00.000Z')
    const jobId = await seedJob(db, cust, tgt, { cron: '* * * * *', nextFireAt: past })

    const tick = new Date('2026-05-12T14:30:00.000Z')
    const result = await runScheduled({ db, dispatchQueue: queue, now: () => tick })

    expect(result.enqueued).toBe(1)
    expect(sent[0]?.jobId).toBe(jobId)
    expect(sent[0]?.scheduledAt.toISOString()).toBe(tick.toISOString())
    const [row] = await db.select().from(jobs).where(eq(jobs.id, jobId))
    expect(row?.nextFireAt?.toISOString()).toBe('2026-05-12T14:31:00.000Z')
    expect(row?.lastFireAt?.toISOString()).toBe(tick.toISOString())
  })

  it('skips Jobs whose next_fire_at is in the future', async () => {
    const db = createTestDb()
    const { queue, sent } = createCaptureQueue()
    const cust = await seedCustomer(db)
    const tgt = await seedTarget(db, cust)
    const future = new Date('2026-05-12T14:31:30.000Z')
    await seedJob(db, cust, tgt, { nextFireAt: future })

    const tick = new Date('2026-05-12T14:30:00.000Z')
    const result = await runScheduled({ db, dispatchQueue: queue, now: () => tick })

    expect(result.enqueued).toBe(0)
    expect(sent).toHaveLength(0)
  })

  it('skips paused, archived, and non-cron Jobs', async () => {
    const db = createTestDb()
    const { queue, sent } = createCaptureQueue()
    const cust = await seedCustomer(db)
    const tgt = await seedTarget(db, cust)
    await seedJob(db, cust, tgt, { status: 'paused' })
    await seedJob(db, cust, tgt, { status: 'archived' })
    await seedJob(db, cust, tgt, { triggerKind: 'webhook' })

    const tick = new Date('2026-05-12T14:30:00.000Z')
    const result = await runScheduled({ db, dispatchQueue: queue, now: () => tick })

    expect(result.enqueued).toBe(0)
    expect(sent).toHaveLength(0)
  })

  it('honors job.trigger_timezone over customer.timezone when computing next_fire_at', async () => {
    const db = createTestDb()
    const { queue, sent } = createCaptureQueue()
    const cust = await seedCustomer(db, 'UTC')
    const tgt = await seedTarget(db, cust)
    const jobId = await seedJob(db, cust, tgt, {
      cron: '0 9 * * *',
      triggerTimezone: 'America/New_York',
      nextFireAt: null,
    })

    const tick = new Date('2026-05-12T14:30:00.000Z')
    await runScheduled({ db, dispatchQueue: queue, now: () => tick })

    const [row] = await db.select().from(jobs).where(eq(jobs.id, jobId))
    expect(row?.nextFireAt?.toISOString()).toBe('2026-05-13T13:00:00.000Z')
    expect(sent).toHaveLength(0)
  })

  it('sweeps stale fire_in_progress claims older than 5 minutes', async () => {
    const db = createTestDb()
    const { queue } = createCaptureQueue()
    const cust = await seedCustomer(db)
    const tgt = await seedTarget(db, cust)
    const staleJobId = await seedJob(db, cust, tgt, { status: 'paused' })
    const tick = new Date('2026-05-12T14:30:00.000Z')
    const stale = new Date(tick.getTime() - 10 * 60_000)
    await db
      .update(jobs)
      .set({ fireInProgress: true, updatedAt: stale })
      .where(eq(jobs.id, staleJobId))

    const result = await runScheduled({ db, dispatchQueue: queue, now: () => tick })

    expect(result.swept).toBe(1)
    const [row] = await db.select().from(jobs).where(eq(jobs.id, staleJobId))
    expect(row?.fireInProgress).toBe(false)
  })

  it('does not sweep fresh in-progress claims', async () => {
    const db = createTestDb()
    const { queue } = createCaptureQueue()
    const cust = await seedCustomer(db)
    const tgt = await seedTarget(db, cust)
    const freshJobId = await seedJob(db, cust, tgt, { status: 'paused' })
    const tick = new Date('2026-05-12T14:30:00.000Z')
    await db
      .update(jobs)
      .set({ fireInProgress: true, updatedAt: tick })
      .where(eq(jobs.id, freshJobId))

    const result = await runScheduled({ db, dispatchQueue: queue, now: () => tick })

    expect(result.swept).toBe(0)
    const [row] = await db.select().from(jobs).where(eq(jobs.id, freshJobId))
    expect(row?.fireInProgress).toBe(true)
  })
})
