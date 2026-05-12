import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { newId } from '@/lib/db/ids'
import { customers, jobs, targets } from '@/lib/db/schema'
import { createTestDb } from '@/lib/db/test-db'
import { claimJob, releaseJob } from './claim'

async function seedJob() {
  const db = createTestDb()
  const customerId = newId('cust')
  const targetId = newId('tgt')
  const jobId = newId('job')
  await db.insert(customers).values({
    id: customerId,
    name: 'Acme',
    slug: 'acme',
    timezone: 'UTC',
  })
  await db.insert(targets).values({
    id: targetId,
    customerId,
    name: 'Health',
    url: 'https://example.test/ping',
    method: 'GET',
  })
  await db.insert(jobs).values({
    id: jobId,
    customerId,
    targetId,
    name: 'Ping',
    slug: 'ping',
    triggerKind: 'cron',
    cronExpression: '* * * * *',
  })
  return { db, jobId }
}

describe('claimJob / releaseJob', () => {
  it('claims an idle job', async () => {
    const { db, jobId } = await seedJob()
    const claimed = await claimJob(db, jobId)
    expect(claimed).toBe(jobId)
    const [row] = await db.select().from(jobs).where(eq(jobs.id, jobId))
    expect(row?.fireInProgress).toBe(true)
  })

  it('returns null when the job is already in progress', async () => {
    const { db, jobId } = await seedJob()
    expect(await claimJob(db, jobId)).toBe(jobId)
    expect(await claimJob(db, jobId)).toBeNull()
  })

  it('exactly one of two concurrent claims wins', async () => {
    const { db, jobId } = await seedJob()
    const [a, b] = await Promise.all([claimJob(db, jobId), claimJob(db, jobId)])
    const winners = [a, b].filter((id) => id === jobId)
    expect(winners).toHaveLength(1)
  })

  it('releaseJob clears the flag so a subsequent claim succeeds', async () => {
    const { db, jobId } = await seedJob()
    await claimJob(db, jobId)
    await releaseJob(db, jobId)
    expect(await claimJob(db, jobId)).toBe(jobId)
  })

  it('releaseJob on a never-claimed row is a no-op', async () => {
    const { db, jobId } = await seedJob()
    await releaseJob(db, jobId)
    const [row] = await db.select().from(jobs).where(eq(jobs.id, jobId))
    expect(row?.fireInProgress).toBe(false)
  })
})
