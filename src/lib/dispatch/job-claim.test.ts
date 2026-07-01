import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { newId } from '@/lib/db/ids'
import { jobs, targets, workspaces } from '@/lib/db/schema'
import { createTestDb } from '@/lib/db/test-db'
import { claim, reapStale, release, STALE_CLAIM_FLOOR_MS, STALE_CLAIM_MARGIN_MS } from './job-claim'

async function seedJob(overallDeadlineMs?: number) {
  const db = createTestDb()
  const workspaceId = newId('cust')
  const targetId = newId('tgt')
  const jobId = newId('job')
  await db.insert(workspaces).values({
    id: workspaceId,
    name: 'Acme',
    slug: 'acme',
    timezone: 'UTC',
  })
  await db.insert(targets).values({
    id: targetId,
    workspaceId,
    name: 'Health',
    slug: 'health',
    url: 'https://example.test/ping',
    method: 'GET',
  })
  await db.insert(jobs).values({
    id: jobId,
    workspaceId,
    targetId,
    name: 'Ping',
    slug: 'ping',
    triggerKind: 'cron',
    cronExpression: '* * * * *',
    ...(overallDeadlineMs !== undefined && { overallDeadlineMs }),
  })
  return { db, jobId }
}

describe('claim / release', () => {
  it('claims an idle job', async () => {
    const { db, jobId } = await seedJob()
    const claimed = await claim(db, jobId)
    expect(claimed).toBe(jobId)
    const [row] = await db.select().from(jobs).where(eq(jobs.id, jobId))
    expect(row?.fireInProgress).toBe(true)
  })

  it('returns null when the job is already in progress', async () => {
    const { db, jobId } = await seedJob()
    expect(await claim(db, jobId)).toBe(jobId)
    expect(await claim(db, jobId)).toBeNull()
  })

  it('exactly one of two concurrent claims wins', async () => {
    const { db, jobId } = await seedJob()
    const [a, b] = await Promise.all([claim(db, jobId), claim(db, jobId)])
    const winners = [a, b].filter((id) => id === jobId)
    expect(winners).toHaveLength(1)
  })

  it('release clears the flag so a subsequent claim succeeds', async () => {
    const { db, jobId } = await seedJob()
    await claim(db, jobId)
    await release(db, jobId)
    expect(await claim(db, jobId)).toBe(jobId)
  })

  it('release on a never-claimed row is a no-op', async () => {
    const { db, jobId } = await seedJob()
    await release(db, jobId)
    const [row] = await db.select().from(jobs).where(eq(jobs.id, jobId))
    expect(row?.fireInProgress).toBe(false)
  })
})

async function holdClaimSince(
  db: Awaited<ReturnType<typeof seedJob>>['db'],
  jobId: string,
  at: Date,
) {
  await db.update(jobs).set({ fireInProgress: true, updatedAt: at }).where(eq(jobs.id, jobId))
}

describe('reapStale', () => {
  const tick = new Date('2026-05-12T14:30:00.000Z')

  it('does not reap a claim younger than the floor TTL', async () => {
    const { db, jobId } = await seedJob()
    await holdClaimSince(db, jobId, new Date(tick.getTime() - (STALE_CLAIM_FLOOR_MS - 60_000)))

    expect(await reapStale(db, tick)).toBe(0)
    const [row] = await db.select().from(jobs).where(eq(jobs.id, jobId))
    expect(row?.fireInProgress).toBe(true)
  })

  it('reaps a claim held longer than the floor TTL', async () => {
    const { db, jobId } = await seedJob()
    await holdClaimSince(db, jobId, new Date(tick.getTime() - (STALE_CLAIM_FLOOR_MS + 60_000)))

    expect(await reapStale(db, tick)).toBe(1)
    const [row] = await db.select().from(jobs).where(eq(jobs.id, jobId))
    expect(row?.fireInProgress).toBe(false)
  })

  it('does not reap a long-deadline Job before its deadline + margin', async () => {
    const longDeadlineMs = STALE_CLAIM_FLOOR_MS * 3
    const { db, jobId } = await seedJob(longDeadlineMs)
    // Held longer than the floor but shorter than deadline + margin.
    await holdClaimSince(
      db,
      jobId,
      new Date(tick.getTime() - (longDeadlineMs + STALE_CLAIM_MARGIN_MS - 60_000)),
    )

    expect(await reapStale(db, tick)).toBe(0)
    const [row] = await db.select().from(jobs).where(eq(jobs.id, jobId))
    expect(row?.fireInProgress).toBe(true)
  })

  it('reaps a long-deadline Job once held past its deadline + margin', async () => {
    const longDeadlineMs = STALE_CLAIM_FLOOR_MS * 3
    const { db, jobId } = await seedJob(longDeadlineMs)
    await holdClaimSince(
      db,
      jobId,
      new Date(tick.getTime() - (longDeadlineMs + STALE_CLAIM_MARGIN_MS + 60_000)),
    )

    expect(await reapStale(db, tick)).toBe(1)
    const [row] = await db.select().from(jobs).where(eq(jobs.id, jobId))
    expect(row?.fireInProgress).toBe(false)
  })

  it('leaves an idle (unclaimed) row untouched', async () => {
    const { db, jobId } = await seedJob()
    expect(await reapStale(db, tick)).toBe(0)
    const [row] = await db.select().from(jobs).where(eq(jobs.id, jobId))
    expect(row?.fireInProgress).toBe(false)
  })
})
