import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import type { Database } from '@/lib/db/client'
import { newId } from '@/lib/db/ids'
import { jobs, runs, targets, workspaces } from '@/lib/db/schema'
import { createTestDb } from '@/lib/db/test-db'
import { generateSecret } from '@/lib/webhook-secrets/commands'
import { signWebhook } from '@/lib/webhook-signing/sign'
import type { DispatchMessage } from './scheduled'
import { handleWebhook, type WebhookDeps } from './webhook'

function captureQueue(): { queue: Queue<DispatchMessage>; sent: DispatchMessage[] } {
  const sent: DispatchMessage[] = []
  const queue = {
    async send(body: DispatchMessage) {
      sent.push(body)
    },
    async sendBatch() {},
  }
  return { queue: queue as unknown as Queue<DispatchMessage>, sent }
}

function stubRateLimit(success: boolean): WebhookDeps['rateLimit'] {
  return {
    async limit() {
      return { success }
    },
  }
}

interface JobOverrides {
  status?: 'active' | 'paused' | 'archived'
  triggerKind?: 'cron' | 'interval' | 'webhook'
  workspaceSlug?: string
  jobSlug?: string
}

async function seedJobForWebhook(db: Database, o: JobOverrides = {}) {
  const workspaceId = newId('cust')
  const targetId = newId('tgt')
  const jobId = newId('job')
  await db.insert(workspaces).values({
    id: workspaceId,
    name: 'Acme',
    slug: o.workspaceSlug ?? 'acme',
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
    name: 'Hook',
    slug: o.jobSlug ?? 'health-check',
    triggerKind: o.triggerKind ?? 'webhook',
    ...(o.status !== undefined && { status: o.status }),
  })
  return {
    workspaceId,
    jobId,
    workspaceSlug: o.workspaceSlug ?? 'acme',
    jobSlug: o.jobSlug ?? 'health-check',
  }
}

const FIXED = new Date('2026-05-12T14:30:00.000Z')

async function signedRequest(secret: string, body: string, atMs: number = FIXED.getTime()) {
  const header = await signWebhook({
    secret,
    timestamp: Math.floor(atMs / 1000),
    body,
  })
  return new Request('https://example.test/w/acme/health-check', {
    method: 'POST',
    headers: { 'X-Boop-Signature': header },
    body,
  })
}

describe('handleWebhook (signed happy path)', () => {
  it('returns 200, pre-creates a scheduled Run, and enqueues with the runId', async () => {
    const db = createTestDb()
    const { queue, sent } = captureQueue()
    const { workspaceSlug, jobSlug, jobId, workspaceId } = await seedJobForWebhook(db)
    const { plaintext } = await generateSecret({ db, now: () => FIXED }, jobId)

    const req = await signedRequest(plaintext, '{"hello":"world"}')

    const res = await handleWebhook(
      { db, dispatchQueue: queue, rateLimit: stubRateLimit(true), now: () => FIXED },
      req,
      workspaceSlug,
      jobSlug,
    )

    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      accepted: boolean
      runId: string
      scheduledAt: string
    }
    expect(body.accepted).toBe(true)
    expect(body.runId).toMatch(/^run_/)
    expect(body.scheduledAt).toBe(FIXED.toISOString())

    expect(sent).toHaveLength(1)
    expect(sent[0]).toMatchObject({
      jobId,
      runId: body.runId,
      triggerSource: 'webhook',
    })

    const [runRow] = await db.select().from(runs).where(eq(runs.id, body.runId))
    expect(runRow?.status).toBe('scheduled')
    expect(runRow?.workspaceId).toBe(workspaceId)
    expect(runRow?.triggerSource).toBe('webhook')
    expect(runRow?.scheduledAt.toISOString()).toBe(FIXED.toISOString())
  })

  it('verifies against any active secret during rotation overlap', async () => {
    const db = createTestDb()
    const { queue, sent } = captureQueue()
    const { workspaceSlug, jobSlug, jobId } = await seedJobForWebhook(db)
    await generateSecret({ db, now: () => new Date(FIXED.getTime() - 60_000) }, jobId)
    const { plaintext: newSecret } = await generateSecret(
      { db, now: () => new Date(FIXED.getTime() - 1000) },
      jobId,
    )

    const req = await signedRequest(newSecret, 'payload')
    const res = await handleWebhook(
      { db, dispatchQueue: queue, rateLimit: stubRateLimit(true), now: () => FIXED },
      req,
      workspaceSlug,
      jobSlug,
    )

    expect(res.status).toBe(200)
    expect(sent).toHaveLength(1)
  })
})

describe('handleWebhook (rejection paths)', () => {
  it('returns 429 when the rate limit binding denies the request, before any DB read', async () => {
    const db = createTestDb()
    const { queue, sent } = captureQueue()
    const { workspaceSlug, jobSlug, jobId } = await seedJobForWebhook(db)
    const { plaintext } = await generateSecret({ db, now: () => FIXED }, jobId)

    const req = await signedRequest(plaintext, 'x')
    const res = await handleWebhook(
      { db, dispatchQueue: queue, rateLimit: stubRateLimit(false), now: () => FIXED },
      req,
      workspaceSlug,
      jobSlug,
    )
    expect(res.status).toBe(429)
    expect(sent).toHaveLength(0)
    const inserted = await db.select().from(runs)
    expect(inserted).toHaveLength(0)
  })

  it('returns 404 when the workspace slug is unknown', async () => {
    const db = createTestDb()
    const { queue, sent } = captureQueue()
    await seedJobForWebhook(db, { workspaceSlug: 'acme', jobSlug: 'hook' })
    const req = new Request('https://example.test/w/nope/hook', { method: 'POST', body: '' })

    const res = await handleWebhook(
      { db, dispatchQueue: queue, rateLimit: stubRateLimit(true) },
      req,
      'nope',
      'hook',
    )
    expect(res.status).toBe(404)
    expect(sent).toHaveLength(0)
  })

  it('returns 404 when the job slug is unknown', async () => {
    const db = createTestDb()
    const { queue, sent } = captureQueue()
    await seedJobForWebhook(db)
    const req = new Request('https://example.test/w/acme/missing', { method: 'POST', body: '' })

    const res = await handleWebhook(
      { db, dispatchQueue: queue, rateLimit: stubRateLimit(true) },
      req,
      'acme',
      'missing',
    )
    expect(res.status).toBe(404)
    expect(sent).toHaveLength(0)
  })

  it('returns 410 when the Job is paused', async () => {
    const db = createTestDb()
    const { queue, sent } = captureQueue()
    const { workspaceSlug, jobSlug } = await seedJobForWebhook(db, { status: 'paused' })
    const req = new Request('https://example.test', { method: 'POST', body: '' })

    const res = await handleWebhook(
      { db, dispatchQueue: queue, rateLimit: stubRateLimit(true) },
      req,
      workspaceSlug,
      jobSlug,
    )
    expect(res.status).toBe(410)
    expect(sent).toHaveLength(0)
  })

  it('returns 410 when the Job is archived', async () => {
    const db = createTestDb()
    const { queue, sent } = captureQueue()
    const { workspaceSlug, jobSlug } = await seedJobForWebhook(db, { status: 'archived' })
    const req = new Request('https://example.test', { method: 'POST', body: '' })

    const res = await handleWebhook(
      { db, dispatchQueue: queue, rateLimit: stubRateLimit(true) },
      req,
      workspaceSlug,
      jobSlug,
    )
    expect(res.status).toBe(410)
    expect(sent).toHaveLength(0)
  })

  it('returns 409 when the Job trigger is cron, not webhook', async () => {
    const db = createTestDb()
    const { queue, sent } = captureQueue()
    const { workspaceSlug, jobSlug } = await seedJobForWebhook(db, { triggerKind: 'cron' })
    const req = new Request('https://example.test', { method: 'POST', body: '' })

    const res = await handleWebhook(
      { db, dispatchQueue: queue, rateLimit: stubRateLimit(true) },
      req,
      workspaceSlug,
      jobSlug,
    )
    expect(res.status).toBe(409)
    expect(sent).toHaveLength(0)
  })

  it('returns 401 when the X-Boop-Signature header is missing', async () => {
    const db = createTestDb()
    const { queue, sent } = captureQueue()
    const { workspaceSlug, jobSlug, jobId } = await seedJobForWebhook(db)
    await generateSecret({ db, now: () => FIXED }, jobId)
    const req = new Request('https://example.test', { method: 'POST', body: 'payload' })

    const res = await handleWebhook(
      { db, dispatchQueue: queue, rateLimit: stubRateLimit(true), now: () => FIXED },
      req,
      workspaceSlug,
      jobSlug,
    )
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'missing_header' })
    expect(sent).toHaveLength(0)
  })

  it('returns 401 when the signature header is malformed', async () => {
    const db = createTestDb()
    const { queue, sent } = captureQueue()
    const { workspaceSlug, jobSlug, jobId } = await seedJobForWebhook(db)
    await generateSecret({ db, now: () => FIXED }, jobId)
    const req = new Request('https://example.test', {
      method: 'POST',
      headers: { 'X-Boop-Signature': 'this is not parseable' },
      body: 'payload',
    })

    const res = await handleWebhook(
      { db, dispatchQueue: queue, rateLimit: stubRateLimit(true), now: () => FIXED },
      req,
      workspaceSlug,
      jobSlug,
    )
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'bad_format' })
    expect(sent).toHaveLength(0)
  })

  it('returns 403 when the timestamp is outside the tolerance window', async () => {
    const db = createTestDb()
    const { queue, sent } = captureQueue()
    const { workspaceSlug, jobSlug, jobId } = await seedJobForWebhook(db)
    const { plaintext } = await generateSecret({ db, now: () => FIXED }, jobId)

    const staleAt = FIXED.getTime() - 6 * 60 * 1000
    const req = await signedRequest(plaintext, 'payload', staleAt)
    const res = await handleWebhook(
      { db, dispatchQueue: queue, rateLimit: stubRateLimit(true), now: () => FIXED },
      req,
      workspaceSlug,
      jobSlug,
    )
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: 'timestamp_skew' })
    expect(sent).toHaveLength(0)
  })

  it('returns 403 when the signature is well-formed but does not match', async () => {
    const db = createTestDb()
    const { queue, sent } = captureQueue()
    const { workspaceSlug, jobSlug, jobId } = await seedJobForWebhook(db)
    await generateSecret({ db, now: () => FIXED }, jobId)

    const req = await signedRequest('wrong-secret', 'payload')
    const res = await handleWebhook(
      { db, dispatchQueue: queue, rateLimit: stubRateLimit(true), now: () => FIXED },
      req,
      workspaceSlug,
      jobSlug,
    )
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: 'no_match' })
    expect(sent).toHaveLength(0)
  })

  it('returns 403 when the Job has no active secrets yet', async () => {
    const db = createTestDb()
    const { queue, sent } = captureQueue()
    const { workspaceSlug, jobSlug } = await seedJobForWebhook(db)

    const req = await signedRequest('anything', 'payload')
    const res = await handleWebhook(
      { db, dispatchQueue: queue, rateLimit: stubRateLimit(true), now: () => FIXED },
      req,
      workspaceSlug,
      jobSlug,
    )
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: 'no_match' })
    expect(sent).toHaveLength(0)
  })
})
