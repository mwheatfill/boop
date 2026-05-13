import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import type { AlertQueueMessage } from '@/lib/alert-queue/types'
import type { Database } from '@/lib/db/client'
import { newId } from '@/lib/db/ids'
import { alertRules, customers, jobs, runs, targets } from '@/lib/db/schema'
import { createTestDb } from '@/lib/db/test-db'
import { evaluateMissedSchedules } from './missed-schedule'

function captureAlertQueue(): {
  queue: Queue<AlertQueueMessage>
  sent: AlertQueueMessage[]
} {
  const sent: AlertQueueMessage[] = []
  const queue = {
    async send(body: AlertQueueMessage) {
      sent.push(body)
    },
    async sendBatch(messages: MessageSendRequest<AlertQueueMessage>[]) {
      sent.push(...messages.map((message) => message.body))
    },
  }
  return { queue: queue as unknown as Queue<AlertQueueMessage>, sent }
}

async function seedCustomer(db: Database, slug: string) {
  const customerId = newId('cust')
  await db.insert(customers).values({
    id: customerId,
    name: slug === 'acme' ? 'Acme' : 'Beta',
    slug,
    timezone: 'UTC',
  })
  return customerId
}

async function seedTarget(db: Database, customerId: string) {
  const targetId = newId('tgt')
  await db.insert(targets).values({
    id: targetId,
    customerId,
    name: 'API',
    slug: `api-${targetId.slice(-4)}`,
    url: 'https://example.com',
    method: 'GET',
  })
  return targetId
}

async function seedJob(
  db: Database,
  customerId: string,
  targetId: string,
  createdAt = new Date('2026-05-10T00:00:00.000Z'),
) {
  const jobId = newId('job')
  await db.insert(jobs).values({
    id: jobId,
    customerId,
    targetId,
    name: `Job ${jobId.slice(-4)}`,
    slug: `job-${jobId.slice(-4)}`,
    triggerKind: 'cron',
    cronExpression: '0 9 * * *',
    triggerTimezone: 'UTC',
    createdAt,
    updatedAt: createdAt,
  })
  return jobId
}

async function seedRun(db: Database, jobId: string, customerId: string, startedAt: Date) {
  await db.insert(runs).values({
    id: newId('run'),
    jobId,
    customerId,
    scheduledAt: startedAt,
    startedAt,
    completedAt: new Date(startedAt.getTime() + 1000),
    status: 'completed',
    outcome: 'success',
  })
}

async function seedRule(
  db: Database,
  input: {
    scope: 'workspace' | 'customer' | 'job'
    customerId?: string
    jobId?: string
    minutes: number
    channelIds?: string[]
  },
) {
  const id = newId('rul')
  await db.insert(alertRules).values({
    id,
    scope: input.scope,
    customerId: input.customerId ?? null,
    jobId: input.jobId ?? null,
    kind: 'missed_schedule',
    name: 'Silence alert',
    slug: `silence-${id.slice(-4)}`,
    config: JSON.stringify({ silence_threshold_minutes: input.minutes }),
    channelIds: JSON.stringify(input.channelIds ?? ['chn_1']),
    status: 'active',
  })
  return id
}

async function seedCustomerJob(db: Database, slug = 'acme') {
  const customerId = await seedCustomer(db, slug)
  const targetId = await seedTarget(db, customerId)
  const jobId = await seedJob(db, customerId, targetId)
  return { customerId, targetId, jobId }
}

describe('evaluateMissedSchedules', () => {
  it('does not alert without a missed_schedule rule', async () => {
    const db = createTestDb()
    const { queue, sent } = captureAlertQueue()
    const { customerId, jobId } = await seedCustomerJob(db)
    await seedRun(db, jobId, customerId, new Date('2026-05-10T00:00:00.000Z'))

    const result = await evaluateMissedSchedules({
      db,
      alertQueue: queue,
      now: () => new Date('2026-05-24T00:00:00.000Z'),
    })

    expect(result.enqueued).toBe(0)
    expect(sent).toEqual([])
  })

  it('alerts when the last Run is older than the silence threshold', async () => {
    const db = createTestDb()
    const { queue, sent } = captureAlertQueue()
    const { customerId, jobId } = await seedCustomerJob(db)
    await seedRun(db, jobId, customerId, new Date('2026-05-11T23:00:00.000Z'))
    const ruleId = await seedRule(db, { scope: 'customer', customerId, minutes: 24 * 60 })

    const result = await evaluateMissedSchedules({
      db,
      alertQueue: queue,
      now: () => new Date('2026-05-13T00:00:00.000Z'),
    })

    expect(result).toMatchObject({ firingRules: 1, enqueued: 1 })
    expect(sent[0]).toMatchObject({
      jobId,
      ruleId,
      ruleKind: 'missed_schedule',
      lastRunAt: '2026-05-11T23:00:00.000Z',
      silenceThresholdMinutes: 1440,
    })
  })

  it('debounces until another real Run starts', async () => {
    const db = createTestDb()
    const { queue, sent } = captureAlertQueue()
    const { customerId, jobId } = await seedCustomerJob(db)
    await seedRun(db, jobId, customerId, new Date('2026-05-11T23:00:00.000Z'))
    await seedRule(db, { scope: 'customer', customerId, minutes: 24 * 60 })

    await evaluateMissedSchedules({
      db,
      alertQueue: queue,
      now: () => new Date('2026-05-13T00:00:00.000Z'),
    })
    await evaluateMissedSchedules({
      db,
      alertQueue: queue,
      now: () => new Date('2026-05-13T00:01:00.000Z'),
    })

    expect(sent).toHaveLength(1)
    await seedRun(db, jobId, customerId, new Date('2026-05-13T00:02:00.000Z'))
    await evaluateMissedSchedules({
      db,
      alertQueue: queue,
      now: () => new Date('2026-05-14T00:03:00.000Z'),
    })
    expect(sent).toHaveLength(2)
  })

  it('uses job.created_at when a Job has never run', async () => {
    const db = createTestDb()
    const { queue, sent } = captureAlertQueue()
    const { customerId } = await seedCustomerJob(db)
    await seedRule(db, { scope: 'customer', customerId, minutes: 60 })

    await evaluateMissedSchedules({
      db,
      alertQueue: queue,
      now: () => new Date('2026-05-10T02:00:00.000Z'),
    })

    expect(sent).toHaveLength(1)
    expect(sent[0]).toMatchObject({ lastRunAt: null })
  })

  it('fans out a workspace rule across multiple Customers', async () => {
    const db = createTestDb()
    const { queue, sent } = captureAlertQueue()
    const acme = await seedCustomerJob(db, 'acme')
    const beta = await seedCustomerJob(db, 'beta')
    await Promise.all([
      seedRun(db, acme.jobId, acme.customerId, new Date('2026-05-10T00:00:00.000Z')),
      seedRun(db, beta.jobId, beta.customerId, new Date('2026-05-10T00:00:00.000Z')),
    ])
    await seedRule(db, { scope: 'workspace', minutes: 24 * 60, channelIds: ['chn_ws'] })

    await evaluateMissedSchedules({
      db,
      alertQueue: queue,
      now: () => new Date('2026-05-12T00:00:00.000Z'),
    })

    expect(sent.map((message) => ('jobId' in message ? message.jobId : '')).sort()).toEqual(
      [acme.jobId, beta.jobId].sort(),
    )
  })

  it('keeps customer-scoped rules inside their Customer', async () => {
    const db = createTestDb()
    const { queue, sent } = captureAlertQueue()
    const acme = await seedCustomerJob(db, 'acme')
    const beta = await seedCustomerJob(db, 'beta')
    await seedRule(db, { scope: 'customer', customerId: acme.customerId, minutes: 24 * 60 })

    await evaluateMissedSchedules({
      db,
      alertQueue: queue,
      now: () => new Date('2026-05-12T00:00:00.000Z'),
    })

    expect(sent).toHaveLength(1)
    expect(sent[0]).toMatchObject({ jobId: acme.jobId })
    const [betaJob] = await db.select().from(jobs).where(eq(jobs.id, beta.jobId))
    expect(betaJob?.lastMissedAlertAt).toBeNull()
  })
})
