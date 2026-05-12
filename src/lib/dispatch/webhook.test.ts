import { describe, expect, it } from 'vitest'
import type { Database } from '@/lib/db/client'
import { newId } from '@/lib/db/ids'
import { customers, jobs, targets } from '@/lib/db/schema'
import { createTestDb } from '@/lib/db/test-db'
import type { DispatchMessage } from './scheduled'
import { handleWebhook } from './webhook'

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

interface JobOverrides {
  status?: 'active' | 'paused' | 'archived'
  triggerKind?: 'cron' | 'interval' | 'webhook'
  customerSlug?: string
  jobSlug?: string
}

async function seedJobForWebhook(db: Database, o: JobOverrides = {}) {
  const customerId = newId('cust')
  const targetId = newId('tgt')
  const jobId = newId('job')
  await db.insert(customers).values({
    id: customerId,
    name: 'Acme',
    slug: o.customerSlug ?? 'acme',
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
    name: 'Hook',
    slug: o.jobSlug ?? 'health-check',
    triggerKind: o.triggerKind ?? 'webhook',
    ...(o.status !== undefined && { status: o.status }),
  })
  return {
    customerId,
    jobId,
    customerSlug: o.customerSlug ?? 'acme',
    jobSlug: o.jobSlug ?? 'health-check',
  }
}

describe('handleWebhook', () => {
  it('returns 202 and enqueues on happy path', async () => {
    const db = createTestDb()
    const { queue, sent } = captureQueue()
    const fixed = new Date('2026-05-12T14:30:00.000Z')
    const { customerSlug, jobSlug, jobId } = await seedJobForWebhook(db)

    const res = await handleWebhook(
      { db, dispatchQueue: queue, now: () => fixed },
      customerSlug,
      jobSlug,
    )

    expect(res.status).toBe(202)
    expect(await res.json()).toEqual({ accepted: true, runId: null })
    expect(sent).toHaveLength(1)
    expect(sent[0]?.jobId).toBe(jobId)
    expect(sent[0]?.scheduledAt.toISOString()).toBe(fixed.toISOString())
  })

  it('returns 404 with generic message when customer slug is unknown', async () => {
    const db = createTestDb()
    const { queue, sent } = captureQueue()
    await seedJobForWebhook(db, { customerSlug: 'acme', jobSlug: 'hook' })

    const res = await handleWebhook({ db, dispatchQueue: queue }, 'nope', 'hook')
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'not found' })
    expect(sent).toHaveLength(0)
  })

  it('returns 404 (same generic message) when job slug is unknown', async () => {
    const db = createTestDb()
    const { queue, sent } = captureQueue()
    await seedJobForWebhook(db)

    const res = await handleWebhook({ db, dispatchQueue: queue }, 'acme', 'unknown-slug')
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'not found' })
    expect(sent).toHaveLength(0)
  })

  it('returns 410 when the Job is paused', async () => {
    const db = createTestDb()
    const { queue, sent } = captureQueue()
    const { customerSlug, jobSlug } = await seedJobForWebhook(db, { status: 'paused' })

    const res = await handleWebhook({ db, dispatchQueue: queue }, customerSlug, jobSlug)
    expect(res.status).toBe(410)
    expect(sent).toHaveLength(0)
  })

  it('returns 410 when the Job is archived', async () => {
    const db = createTestDb()
    const { queue, sent } = captureQueue()
    const { customerSlug, jobSlug } = await seedJobForWebhook(db, { status: 'archived' })

    const res = await handleWebhook({ db, dispatchQueue: queue }, customerSlug, jobSlug)
    expect(res.status).toBe(410)
    expect(sent).toHaveLength(0)
  })

  it('returns 409 when the Job trigger is cron, not webhook', async () => {
    const db = createTestDb()
    const { queue, sent } = captureQueue()
    const { customerSlug, jobSlug } = await seedJobForWebhook(db, { triggerKind: 'cron' })

    const res = await handleWebhook({ db, dispatchQueue: queue }, customerSlug, jobSlug)
    expect(res.status).toBe(409)
    expect(sent).toHaveLength(0)
  })

  it('returns 409 when the Job trigger is interval, not webhook', async () => {
    const db = createTestDb()
    const { queue, sent } = captureQueue()
    const { customerSlug, jobSlug } = await seedJobForWebhook(db, { triggerKind: 'interval' })

    const res = await handleWebhook({ db, dispatchQueue: queue }, customerSlug, jobSlug)
    expect(res.status).toBe(409)
    expect(sent).toHaveLength(0)
  })
})
