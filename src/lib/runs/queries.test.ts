import { beforeEach, describe, expect, it } from 'vitest'
import type { Database } from '@/lib/db/client'
import { newId } from '@/lib/db/ids'
import { attempts, customers, jobs, runs, targets } from '@/lib/db/schema'
import { createTestDb } from '@/lib/db/test-db'
import { RunsSearchSchema } from './filter-schema'
import { getRunDetail, listAllRuns, listRunsForJob } from './queries'

interface SeedJob {
  customerId: string
  jobId: string
  customerSlug: string
  jobSlug: string
}

async function seedJob(
  db: Database,
  opts: { customerSlug?: string; jobSlug?: string } = {},
): Promise<SeedJob> {
  const customerSlug = opts.customerSlug ?? 'acme'
  const jobSlug = opts.jobSlug ?? 'daily'
  const customerId = newId('cust')
  const targetId = newId('tgt')
  const jobId = newId('job')
  await db.insert(customers).values({
    id: customerId,
    name: customerSlug,
    slug: customerSlug,
    timezone: 'UTC',
  })
  await db.insert(targets).values({
    id: targetId,
    customerId,
    name: 'API',
    slug: 'api',
    url: 'https://example.com',
    method: 'POST',
  })
  await db.insert(jobs).values({
    id: jobId,
    customerId,
    targetId,
    name: 'Daily',
    slug: jobSlug,
    triggerKind: 'cron',
    cronExpression: '* * * * *',
    triggerTimezone: 'UTC',
  })
  return { customerId, jobId, customerSlug, jobSlug }
}

interface RunSeed {
  id?: string
  startedAt: Date
  status?: 'scheduled' | 'running' | 'completed' | 'canceled'
  outcome?: 'success' | 'failure' | 'timeout' | null
  triggerSource?: 'cron' | 'interval' | 'webhook' | 'manual'
  skippedReason?: string | null
}

async function seedRun(
  db: Database,
  { customerId, jobId }: SeedJob,
  seed: RunSeed,
): Promise<string> {
  const id = seed.id ?? newId('run')
  await db.insert(runs).values({
    id,
    jobId,
    customerId,
    scheduledAt: seed.startedAt,
    startedAt: seed.startedAt,
    completedAt: new Date(seed.startedAt.getTime() + 1_000),
    status: seed.status ?? 'completed',
    outcome: seed.outcome === undefined ? 'success' : seed.outcome,
    triggerSource: seed.triggerSource ?? 'cron',
    skippedReason: seed.skippedReason ?? null,
  })
  return id
}

async function seedAttempt(
  db: Database,
  runId: string,
  number: number,
  failureKind: 'timeout' | 'network' | 'http_4xx' | 'http_5xx' | 'non_2xx_other' | null = null,
) {
  await db.insert(attempts).values({
    id: newId('att'),
    runId,
    attemptNumber: number,
    startedAt: new Date(),
    completedAt: new Date(),
    httpStatus: failureKind === null ? 200 : 500,
    failureKind,
    requestHeadersJson: JSON.stringify({ 'X-Run': runId }),
  })
}

describe('getRunDetail', () => {
  it('returns the joined Run + Job + Customer + Target + Attempts in attempt order', async () => {
    const db = createTestDb()
    const seed = await seedJob(db)
    const runId = await seedRun(db, seed, { startedAt: new Date('2026-05-12T15:00:00.000Z') })
    await seedAttempt(db, runId, 2)
    await seedAttempt(db, runId, 1)

    const detail = await getRunDetail(db, seed.customerSlug, seed.jobSlug, runId)
    expect(detail).not.toBeNull()
    expect(detail?.run.id).toBe(runId)
    expect(detail?.customer.slug).toBe('acme')
    expect(detail?.job.slug).toBe('daily')
    expect(detail?.attempts.map((a) => a.attemptNumber)).toEqual([1, 2])
    expect(detail?.attempts[0]?.requestHeaders).toEqual({ 'X-Run': runId })
    expect(detail?.displayOutcome).toBe('success')
  })

  it('renders a skipped Run via displayOutcome', async () => {
    const db = createTestDb()
    const seed = await seedJob(db)
    const runId = await seedRun(db, seed, {
      startedAt: new Date('2026-05-12T15:00:00.000Z'),
      outcome: null,
      skippedReason: 'job paused',
    })
    const detail = await getRunDetail(db, seed.customerSlug, seed.jobSlug, runId)
    expect(detail?.displayOutcome).toBe('skipped')
    expect(detail?.run.skippedReason).toBe('job paused')
  })

  it('returns null for unknown id', async () => {
    const db = createTestDb()
    const seed = await seedJob(db)
    expect(await getRunDetail(db, seed.customerSlug, seed.jobSlug, 'run_missing')).toBeNull()
  })

  it('returns null when the runId does not belong to the given (customer, job) pair', async () => {
    const db = createTestDb()
    const a = await seedJob(db, { customerSlug: 'acme', jobSlug: 'daily' })
    const b = await seedJob(db, { customerSlug: 'beta', jobSlug: 'hourly' })
    const aRunId = await seedRun(db, a, { startedAt: new Date('2026-05-12T15:00:00.000Z') })
    expect(await getRunDetail(db, b.customerSlug, b.jobSlug, aRunId)).toBeNull()
  })
})

describe('listAllRuns', () => {
  const now = new Date('2026-05-12T15:00:00.000Z')

  it('returns all Runs in the 24h window sorted by startedAt DESC', async () => {
    const db = createTestDb()
    const seed = await seedJob(db)
    await seedRun(db, seed, { startedAt: new Date('2026-05-12T13:00:00.000Z') })
    await seedRun(db, seed, { startedAt: new Date('2026-05-12T14:00:00.000Z') })
    const filters = RunsSearchSchema.parse({})
    const result = await listAllRuns(db, { filters, now })
    expect(result.rows).toHaveLength(2)
    expect(result.rows[0]?.startedAt).toBe('2026-05-12T14:00:00.000Z')
    expect(result.nextCursor).toBeNull()
  })

  it('filters by outcome', async () => {
    const db = createTestDb()
    const seed = await seedJob(db)
    await seedRun(db, seed, {
      startedAt: new Date('2026-05-12T14:00:00.000Z'),
      outcome: 'success',
    })
    await seedRun(db, seed, {
      startedAt: new Date('2026-05-12T13:00:00.000Z'),
      outcome: 'failure',
    })
    const filters = RunsSearchSchema.parse({ outcome: 'failure' })
    const result = await listAllRuns(db, { filters, now })
    expect(result.rows.map((r) => r.outcome)).toEqual(['failure'])
  })

  it('filters by triggerSource', async () => {
    const db = createTestDb()
    const seed = await seedJob(db)
    await seedRun(db, seed, {
      startedAt: new Date('2026-05-12T14:00:00.000Z'),
      triggerSource: 'cron',
    })
    await seedRun(db, seed, {
      startedAt: new Date('2026-05-12T13:00:00.000Z'),
      triggerSource: 'manual',
    })
    const filters = RunsSearchSchema.parse({ triggerSource: 'manual' })
    const result = await listAllRuns(db, { filters, now })
    expect(result.rows.map((r) => r.triggerSource)).toEqual(['manual'])
  })

  it('filters by customer slug (multi-select)', async () => {
    const db = createTestDb()
    const a = await seedJob(db, { customerSlug: 'acme', jobSlug: 'a' })
    const b = await seedJob(db, { customerSlug: 'beta', jobSlug: 'b' })
    await seedRun(db, a, { startedAt: new Date('2026-05-12T14:00:00.000Z') })
    await seedRun(db, b, { startedAt: new Date('2026-05-12T13:00:00.000Z') })
    const filters = RunsSearchSchema.parse({ customer: 'beta' })
    const result = await listAllRuns(db, { filters, now })
    expect(result.rows.map((r) => r.customerSlug)).toEqual(['beta'])
  })

  it('cursor-paginates across an exact page boundary', async () => {
    const db = createTestDb()
    const seed = await seedJob(db)
    for (let i = 0; i < 5; i++) {
      await seedRun(db, seed, {
        startedAt: new Date(now.getTime() - (i + 1) * 60_000),
      })
    }
    const filters = RunsSearchSchema.parse({})
    const page1 = await listAllRuns(db, { filters, limit: 2, now })
    expect(page1.rows).toHaveLength(2)
    expect(page1.nextCursor).not.toBeNull()
    const page2 = await listAllRuns(db, {
      filters,
      limit: 2,
      now,
      cursor: page1.nextCursor ?? undefined,
    })
    expect(page2.rows).toHaveLength(2)
    expect(page2.nextCursor).not.toBeNull()
    const page3 = await listAllRuns(db, {
      filters,
      limit: 2,
      now,
      cursor: page2.nextCursor ?? undefined,
    })
    expect(page3.rows).toHaveLength(1)
    expect(page3.nextCursor).toBeNull()
    const allIds = [...page1.rows, ...page2.rows, ...page3.rows].map((r) => r.id)
    expect(new Set(allIds).size).toBe(5)
  })

  it('breaks ties on equal startedAt via id DESC', async () => {
    const db = createTestDb()
    const seed = await seedJob(db)
    const sameMoment = new Date('2026-05-12T14:00:00.000Z')
    await seedRun(db, seed, { id: 'run_aaa', startedAt: sameMoment })
    await seedRun(db, seed, { id: 'run_bbb', startedAt: sameMoment })
    await seedRun(db, seed, { id: 'run_ccc', startedAt: sameMoment })
    const filters = RunsSearchSchema.parse({})
    const result = await listAllRuns(db, { filters, now })
    expect(result.rows.map((r) => r.id)).toEqual(['run_ccc', 'run_bbb', 'run_aaa'])
  })
})

describe('listRunsForJob', () => {
  beforeEach(() => {})

  it('returns Runs for the job in startedAt DESC order with cursor pagination', async () => {
    const db = createTestDb()
    const a = await seedJob(db, { customerSlug: 'acme', jobSlug: 'a' })
    const b = await seedJob(db, { customerSlug: 'acme-2', jobSlug: 'b' })
    await seedRun(db, a, { startedAt: new Date('2026-05-12T14:00:00.000Z') })
    await seedRun(db, a, { startedAt: new Date('2026-05-12T13:00:00.000Z') })
    await seedRun(db, b, { startedAt: new Date('2026-05-12T12:00:00.000Z') })
    const result = await listRunsForJob(db, { jobId: a.jobId, limit: 10 })
    expect(result.rows).toHaveLength(2)
    expect(result.rows.every((r) => r.jobId === a.jobId)).toBe(true)
    expect(result.nextCursor).toBeNull()
  })
})
