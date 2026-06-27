import { eq } from 'drizzle-orm'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Database } from '@/lib/db/client'
import { newId } from '@/lib/db/ids'
import { attempts, jobs, runs, targets, workspaces } from '@/lib/db/schema'
import { createTestDb } from '@/lib/db/test-db'
import { runDispatch } from './dispatch-run'
import {
  ClaimFailedError,
  RenderError,
  TargetHttpError,
  TargetNetworkError,
  TargetTimeoutError,
} from './errors'
import { createTestR2 } from './test-r2'

interface FixtureOverrides {
  maxAttempts?: number
  overallDeadlineMs?: number
  bodyTemplate?: string
}

async function seedFixture(db: Database, overrides: FixtureOverrides = {}) {
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
    method: 'POST',
  })
  await db.insert(jobs).values({
    id: jobId,
    workspaceId,
    targetId,
    name: 'Ping',
    slug: 'ping',
    triggerKind: 'cron',
    cronExpression: '* * * * *',
    bodyTemplate: overrides.bodyTemplate ?? 'run={{ run_id }} at={{ now | iso_date }}',
    headersTemplate: '{ "x-run": "{{ run_id }}" }',
    ...(overrides.maxAttempts !== undefined && { maxAttempts: overrides.maxAttempts }),
    ...(overrides.overallDeadlineMs !== undefined && {
      overallDeadlineMs: overrides.overallDeadlineMs,
    }),
  })
  return { workspaceId, jobId }
}

const noSleep = () => Promise.resolve()

afterEach(() => {
  vi.restoreAllMocks()
})

describe('dispatchRun (happy path)', () => {
  it('writes Run, Attempt, and both R2 keys on a 2xx response', async () => {
    const db = createTestDb()
    const bodies = createTestR2()
    const { workspaceId, jobId } = await seedFixture(db)
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('ok-body', { status: 200 }))

    await runDispatch({ db, bodies, sleep: noSleep }, jobId, new Date('2026-05-12T14:30:00.000Z'))

    const [runRow] = await db.select().from(runs).where(eq(runs.jobId, jobId))
    expect(runRow?.status).toBe('completed')
    expect(runRow?.outcome).toBe('success')
    expect(runRow?.workspaceId).toBe(workspaceId)

    const allAttempts = await db
      .select()
      .from(attempts)
      .where(eq(attempts.runId, runRow?.id ?? ''))
    expect(allAttempts).toHaveLength(1)
    const attemptRow = allAttempts[0]
    expect(attemptRow?.attemptNumber).toBe(1)
    expect(attemptRow?.httpStatus).toBe(200)
    expect(attemptRow?.failureKind).toBeNull()
    expect(attemptRow?.requestBodyR2Key).toBe(`runs/${workspaceId}/${runRow?.id}/1.request`)
    expect(attemptRow?.responseBodyR2Key).toBe(`runs/${workspaceId}/${runRow?.id}/1.response`)
    expect(await (await bodies.get(attemptRow?.requestBodyR2Key ?? ''))?.text()).toMatch(
      /^run=run_/,
    )
    expect(await (await bodies.get(attemptRow?.responseBodyR2Key ?? ''))?.text()).toBe('ok-body')

    const [jobRow] = await db.select().from(jobs).where(eq(jobs.id, jobId))
    expect(jobRow?.fireInProgress).toBe(false)
  })
})

describe('dispatchRun (response body handling)', () => {
  it('records success without timing out when the response body never closes', async () => {
    const db = createTestDb()
    const bodies = createTestR2()
    const { jobId } = await seedFixture(db)
    const neverClosing = new ReadableStream<Uint8Array>({ start() {} })
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(neverClosing, { status: 200 }))

    await runDispatch({ db, bodies, sleep: noSleep, bodyReadTimeoutMs: 20 }, jobId, new Date())

    const [runRow] = await db.select().from(runs).where(eq(runs.jobId, jobId))
    expect(runRow?.status).toBe('completed')
    expect(runRow?.outcome).toBe('success')
    const [attemptRow] = await db
      .select()
      .from(attempts)
      .where(eq(attempts.runId, runRow?.id ?? ''))
    expect(attemptRow?.httpStatus).toBe(200)
    expect(attemptRow?.failureKind).toBeNull()
  })

  it('truncates response bodies larger than the cap', async () => {
    const db = createTestDb()
    const bodies = createTestR2()
    const { jobId } = await seedFixture(db)
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('x'.repeat(1_200_000), { status: 200 }),
    )

    await runDispatch({ db, bodies, sleep: noSleep }, jobId, new Date())

    const [runRow] = await db.select().from(runs).where(eq(runs.jobId, jobId))
    expect(runRow?.outcome).toBe('success')
    const [attemptRow] = await db
      .select()
      .from(attempts)
      .where(eq(attempts.runId, runRow?.id ?? ''))
    const stored = bodies._store.get(attemptRow?.responseBodyR2Key ?? '')
    expect(stored?.byteLength).toBe(1_048_576)
  })
})

describe('dispatchRun (retry semantics)', () => {
  it('retries 503 503 → 200: success with three Attempts', async () => {
    const db = createTestDb()
    const bodies = createTestR2()
    const { jobId } = await seedFixture(db, { overallDeadlineMs: 60 * 60 * 1000 })
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('a', { status: 503 }))
      .mockResolvedValueOnce(new Response('b', { status: 503 }))
      .mockResolvedValueOnce(new Response('ok', { status: 200 }))

    await runDispatch({ db, bodies, sleep: noSleep }, jobId, new Date())

    const [runRow] = await db.select().from(runs).where(eq(runs.jobId, jobId))
    expect(runRow?.outcome).toBe('success')
    const all = await db
      .select()
      .from(attempts)
      .where(eq(attempts.runId, runRow?.id ?? ''))
    expect(all).toHaveLength(3)
    expect(all.map((a) => a.httpStatus)).toEqual([503, 503, 200])
    expect(fetchSpy).toHaveBeenCalledTimes(3)
  })

  it('exhausts max_attempts on persistent 5xx: outcome=failure, throws TargetHttpError', async () => {
    const db = createTestDb()
    const bodies = createTestR2()
    const { jobId } = await seedFixture(db, { overallDeadlineMs: 60 * 60 * 1000 })
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      async () => new Response('nope', { status: 503 }),
    )

    await expect(
      runDispatch({ db, bodies, sleep: noSleep }, jobId, new Date()),
    ).rejects.toBeInstanceOf(TargetHttpError)

    const [runRow] = await db.select().from(runs).where(eq(runs.jobId, jobId))
    expect(runRow?.status).toBe('completed')
    expect(runRow?.outcome).toBe('failure')
    const all = await db
      .select()
      .from(attempts)
      .where(eq(attempts.runId, runRow?.id ?? ''))
    expect(all).toHaveLength(3)
    expect(all.at(-1)?.failureKind).toBe('http_5xx')
  })

  it('4xx is permanent: one Attempt, outcome=failure, no throw', async () => {
    const db = createTestDb()
    const bodies = createTestR2()
    const { jobId } = await seedFixture(db, { overallDeadlineMs: 60 * 60 * 1000 })
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async () => new Response('bad', { status: 404 }))

    await runDispatch({ db, bodies, sleep: noSleep }, jobId, new Date())

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const [runRow] = await db.select().from(runs).where(eq(runs.jobId, jobId))
    expect(runRow?.outcome).toBe('failure')
    const all = await db
      .select()
      .from(attempts)
      .where(eq(attempts.runId, runRow?.id ?? ''))
    expect(all).toHaveLength(1)
    expect(all[0]?.failureKind).toBe('http_4xx')
  })

  it('network error retries until exhausted, throws TargetNetworkError', async () => {
    const db = createTestDb()
    const bodies = createTestR2()
    const { jobId } = await seedFixture(db, { overallDeadlineMs: 60 * 60 * 1000 })
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('dns lookup failed'))

    await expect(
      runDispatch({ db, bodies, sleep: noSleep }, jobId, new Date()),
    ).rejects.toBeInstanceOf(TargetNetworkError)

    const [runRow] = await db.select().from(runs).where(eq(runs.jobId, jobId))
    expect(runRow?.outcome).toBe('failure')
    const all = await db
      .select()
      .from(attempts)
      .where(eq(attempts.runId, runRow?.id ?? ''))
    expect(all).toHaveLength(3)
    expect(all.at(-1)?.failureKind).toBe('network')
    expect(all.at(-1)?.responseBodyR2Key).toBeNull()
  })

  it('overall deadline exceeded: outcome=timeout, last Attempt failure_kind=timeout', async () => {
    const db = createTestDb()
    const bodies = createTestR2()
    const { jobId } = await seedFixture(db, { overallDeadlineMs: 1 })
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response('a', { status: 503 }))

    await expect(
      runDispatch({ db, bodies, sleep: noSleep }, jobId, new Date()),
    ).rejects.toBeInstanceOf(TargetTimeoutError)

    const [runRow] = await db.select().from(runs).where(eq(runs.jobId, jobId))
    expect(runRow?.outcome).toBe('timeout')
    const all = await db
      .select()
      .from(attempts)
      .where(eq(attempts.runId, runRow?.id ?? ''))
    expect(all.at(-1)?.failureKind).toBe('timeout')
  })

  it('per-attempt fetch TimeoutError throws TargetTimeoutError and is retryable', async () => {
    const db = createTestDb()
    const bodies = createTestR2()
    const { jobId } = await seedFixture(db, { maxAttempts: 2, overallDeadlineMs: 60 * 60 * 1000 })
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new DOMException('timed out', 'TimeoutError'))

    await expect(
      runDispatch({ db, bodies, sleep: noSleep }, jobId, new Date()),
    ).rejects.toBeInstanceOf(TargetTimeoutError)

    const [runRow] = await db.select().from(runs).where(eq(runs.jobId, jobId))
    expect(runRow?.outcome).toBe('timeout')
    const all = await db
      .select()
      .from(attempts)
      .where(eq(attempts.runId, runRow?.id ?? ''))
    expect(all).toHaveLength(2)
    expect(all.every((a) => a.failureKind === 'timeout')).toBe(true)
  })
})

describe('dispatchRun (control-flow errors)', () => {
  it('throws ClaimFailedError when a concurrent dispatch holds the claim', async () => {
    const db = createTestDb()
    const bodies = createTestR2()
    const { jobId } = await seedFixture(db)
    await db.update(jobs).set({ fireInProgress: true }).where(eq(jobs.id, jobId))

    await expect(
      runDispatch({ db, bodies, sleep: noSleep }, jobId, new Date()),
    ).rejects.toBeInstanceOf(ClaimFailedError)
  })

  it('releases the claim even when the Job is paused', async () => {
    const db = createTestDb()
    const bodies = createTestR2()
    const { jobId } = await seedFixture(db)
    await db.update(jobs).set({ status: 'paused' }).where(eq(jobs.id, jobId))

    await expect(runDispatch({ db, bodies, sleep: noSleep }, jobId, new Date())).rejects.toThrow(
      /not dispatchable: paused/,
    )
    const [row] = await db.select().from(jobs).where(eq(jobs.id, jobId))
    expect(row?.fireInProgress).toBe(false)
  })

  it('throws RenderError when the body template is malformed', async () => {
    const db = createTestDb()
    const bodies = createTestR2()
    const { jobId } = await seedFixture(db, { bodyTemplate: '{{ now | nonsense }}' })
    vi.spyOn(globalThis, 'fetch')

    await expect(
      runDispatch({ db, bodies, sleep: noSleep }, jobId, new Date()),
    ).rejects.toBeInstanceOf(RenderError)
    const [runRow] = await db.select().from(runs).where(eq(runs.jobId, jobId))
    expect(runRow?.outcome).toBe('failure')
    expect(runRow?.status).toBe('completed')
  })
})
