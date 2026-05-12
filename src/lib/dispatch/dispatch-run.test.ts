import { eq } from 'drizzle-orm'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Database } from '@/lib/db/client'
import { newId } from '@/lib/db/ids'
import { attempts, customers, jobs, runs, targets } from '@/lib/db/schema'
import { createTestDb } from '@/lib/db/test-db'
import { runDispatch } from './dispatch-run'
import { ClaimFailedError } from './errors'
import { createTestR2 } from './test-r2'

async function seedFixture(db: Database) {
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
    method: 'POST',
  })
  await db.insert(jobs).values({
    id: jobId,
    customerId,
    targetId,
    name: 'Ping',
    slug: 'ping',
    triggerKind: 'cron',
    cronExpression: '* * * * *',
    bodyTemplate: 'run={{ run_id }} at={{ now | iso_date }}',
    headersTemplate: '{ "x-run": "{{ run_id }}" }',
  })
  return { customerId, jobId }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('dispatchRun (happy path)', () => {
  it('writes Run, Attempt, and both R2 keys on a 2xx response', async () => {
    const db = createTestDb()
    const bodies = createTestR2()
    const { customerId, jobId } = await seedFixture(db)
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('ok-body', { status: 200 }))

    await runDispatch({ db, bodies }, jobId, new Date('2026-05-12T14:30:00.000Z'))

    const [runRow] = await db.select().from(runs).where(eq(runs.jobId, jobId))
    expect(runRow?.status).toBe('completed')
    expect(runRow?.outcome).toBe('success')
    expect(runRow?.customerId).toBe(customerId)

    const [attemptRow] = await db
      .select()
      .from(attempts)
      .where(eq(attempts.runId, runRow?.id ?? ''))
    expect(attemptRow?.attemptNumber).toBe(1)
    expect(attemptRow?.httpStatus).toBe(200)
    expect(attemptRow?.failureKind).toBeNull()

    const reqKey = `runs/${customerId}/${runRow?.id}/1.request`
    const resKey = `runs/${customerId}/${runRow?.id}/1.response`
    expect(attemptRow?.requestBodyR2Key).toBe(reqKey)
    expect(attemptRow?.responseBodyR2Key).toBe(resKey)
    expect(await (await bodies.get(reqKey))?.text()).toMatch(/^run=run_/)
    expect(await (await bodies.get(resKey))?.text()).toBe('ok-body')

    const [jobRow] = await db.select().from(jobs).where(eq(jobs.id, jobId))
    expect(jobRow?.fireInProgress).toBe(false)
  })

  it('marks failure_kind=http_5xx when Target returns 500', async () => {
    const db = createTestDb()
    const bodies = createTestR2()
    const { jobId } = await seedFixture(db)
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('bad', { status: 500 }))

    await runDispatch({ db, bodies }, jobId, new Date())

    const [runRow] = await db.select().from(runs).where(eq(runs.jobId, jobId))
    expect(runRow?.outcome).toBe('failure')
    const [attemptRow] = await db
      .select()
      .from(attempts)
      .where(eq(attempts.runId, runRow?.id ?? ''))
    expect(attemptRow?.failureKind).toBe('http_5xx')
    expect(attemptRow?.httpStatus).toBe(500)
  })

  it('marks failure_kind=network when fetch throws', async () => {
    const db = createTestDb()
    const bodies = createTestR2()
    const { jobId } = await seedFixture(db)
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('dns lookup failed'))

    await runDispatch({ db, bodies }, jobId, new Date())

    const [runRow] = await db.select().from(runs).where(eq(runs.jobId, jobId))
    expect(runRow?.outcome).toBe('failure')
    const [attemptRow] = await db
      .select()
      .from(attempts)
      .where(eq(attempts.runId, runRow?.id ?? ''))
    expect(attemptRow?.failureKind).toBe('network')
    expect(attemptRow?.httpStatus).toBeNull()
    expect(attemptRow?.responseBodyR2Key).toBeNull()
  })

  it('releases the claim even when the dispatch throws after claim', async () => {
    const db = createTestDb()
    const bodies = createTestR2()
    const { jobId } = await seedFixture(db)
    await db.update(jobs).set({ status: 'paused' }).where(eq(jobs.id, jobId))

    await expect(runDispatch({ db, bodies }, jobId, new Date())).rejects.toThrow(
      /not dispatchable: paused/,
    )
    const [row] = await db.select().from(jobs).where(eq(jobs.id, jobId))
    expect(row?.fireInProgress).toBe(false)
  })

  it('throws ClaimFailedError when a concurrent dispatch holds the claim', async () => {
    const db = createTestDb()
    const bodies = createTestR2()
    const { jobId } = await seedFixture(db)
    await db.update(jobs).set({ fireInProgress: true }).where(eq(jobs.id, jobId))

    await expect(runDispatch({ db, bodies }, jobId, new Date())).rejects.toBeInstanceOf(
      ClaimFailedError,
    )
  })
})
