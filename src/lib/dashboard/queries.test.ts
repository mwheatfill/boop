import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { newId } from '@/lib/db/ids'
import { customers, jobs, runs } from '@/lib/db/schema'
import { createTestDb } from '@/lib/db/test-db'
import { dashboardSummary } from './queries'

async function seedCustomerJob(db: ReturnType<typeof createTestDb>) {
  const customerId = newId('cust')
  const targetId = newId('tgt')
  const jobId = newId('job')
  const now = new Date('2026-05-12T12:00:00Z')

  await db.insert(customers).values({
    id: customerId,
    name: 'Acme',
    slug: 'acme',
    timezone: 'UTC',
    createdAt: now,
    updatedAt: now,
  })

  // Insert a Target row directly so the FK constraint on jobs holds.
  await db.run(
    `INSERT INTO targets (id, customer_id, name, slug, url, method, auth_kind, reachability, status, created_at, updated_at)
     VALUES ('${targetId}', '${customerId}', 'API', 'api', 'https://x', 'POST', 'none', 'public', 'active', ${now.getTime()}, ${now.getTime()})` as never,
  )

  await db.insert(jobs).values({
    id: jobId,
    customerId,
    targetId,
    name: 'Backup',
    slug: 'backup',
    triggerKind: 'cron',
    cronExpression: '0 9 * * *',
    triggerTimezone: 'UTC',
    bodyTemplate: '',
    headersTemplate: '{}',
    maxAttempts: 3,
    overallDeadlineMs: 60_000,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  })

  return { customerId, jobId, now }
}

describe('dashboardSummary', () => {
  it('returns zeros for an empty workspace', async () => {
    const db = createTestDb()
    const summary = await dashboardSummary(db)
    expect(summary.stats.activeJobs).toBe(0)
    expect(summary.stats.runsToday).toBe(0)
    expect(summary.stats.failingToday).toBe(0)
    expect(summary.stats.successRate7d).toBe(0)
    expect(summary.runsSeries7d).toHaveLength(7)
    expect(summary.needsAttention).toEqual([])
    expect(summary.upcomingFires).toEqual([])
    expect(summary.recentFailures).toEqual([])
  })

  it('counts active jobs and computes upcoming fires for cron Jobs', async () => {
    const db = createTestDb()
    const { now } = await seedCustomerJob(db)
    const summary = await dashboardSummary(db, now)
    expect(summary.stats.activeJobs).toBe(1)
    expect(summary.upcomingFires).toHaveLength(1)
    expect(summary.upcomingFires[0]?.jobSlug).toBe('backup')
    expect(summary.upcomingFires[0]?.nextFireAt).toBeGreaterThan(now.getTime())
  })

  it('flags failing Jobs in Needs Attention when the last terminal Run failed in the last 24h', async () => {
    const db = createTestDb()
    const { customerId, jobId, now } = await seedCustomerJob(db)
    const runId = newId('run')
    const tenMinutesAgo = new Date(now.getTime() - 10 * 60_000)
    await db.insert(runs).values({
      id: runId,
      jobId,
      customerId,
      scheduledAt: tenMinutesAgo,
      startedAt: tenMinutesAgo,
      completedAt: tenMinutesAgo,
      status: 'completed',
      outcome: 'failure',
      triggerSource: 'cron',
      createdAt: tenMinutesAgo,
      updatedAt: tenMinutesAgo,
    })

    const summary = await dashboardSummary(db, now)
    expect(summary.stats.failingToday).toBe(1)
    expect(
      summary.needsAttention.some((r) => r.jobSlug === 'backup' && r.status === 'failing'),
    ).toBe(true)
    expect(summary.recentFailures[0]?.runId).toBe(runId)
  })

  it('includes paused Jobs in Needs Attention', async () => {
    const db = createTestDb()
    const { jobId, now } = await seedCustomerJob(db)
    await db.update(jobs).set({ status: 'paused' }).where(eq(jobs.id, jobId))
    const summary = await dashboardSummary(db, now)
    expect(summary.needsAttention.some((r) => r.status === 'paused')).toBe(true)
  })
})

