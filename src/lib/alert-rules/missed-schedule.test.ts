import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import type { AlertQueueMessage } from '@/lib/alert-queue/types'
import type { Database } from '@/lib/db/client'
import { newId } from '@/lib/db/ids'
import { alertRules, jobs, runs, targets, workspaces } from '@/lib/db/schema'
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

async function seedWorkspace(db: Database, slug: string) {
  const workspaceId = newId('cust')
  await db.insert(workspaces).values({
    id: workspaceId,
    name: slug === 'acme' ? 'Acme' : 'Beta',
    slug,
    timezone: 'UTC',
  })
  return workspaceId
}

async function seedTarget(db: Database, workspaceId: string) {
  const targetId = newId('tgt')
  await db.insert(targets).values({
    id: targetId,
    workspaceId,
    name: 'API',
    slug: `api-${targetId.slice(-4)}`,
    url: 'https://example.com',
    method: 'GET',
  })
  return targetId
}

async function seedJob(
  db: Database,
  workspaceId: string,
  targetId: string,
  createdAt = new Date('2026-05-10T00:00:00.000Z'),
) {
  const jobId = newId('job')
  await db.insert(jobs).values({
    id: jobId,
    workspaceId,
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

async function seedRun(db: Database, jobId: string, workspaceId: string, startedAt: Date) {
  await db.insert(runs).values({
    id: newId('run'),
    jobId,
    workspaceId,
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
    scope: 'workspace' | 'job'
    workspaceId?: string
    jobId?: string
    minutes: number
    channelIds?: string[]
  },
) {
  const id = newId('rul')
  await db.insert(alertRules).values({
    id,
    scope: input.scope,
    workspaceId: input.workspaceId ?? null,
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

async function seedWorkspaceJob(db: Database, slug = 'acme') {
  const workspaceId = await seedWorkspace(db, slug)
  const targetId = await seedTarget(db, workspaceId)
  const jobId = await seedJob(db, workspaceId, targetId)
  return { workspaceId, targetId, jobId }
}

describe('evaluateMissedSchedules', () => {
  it('does not alert without a missed_schedule rule', async () => {
    const db = createTestDb()
    const { queue, sent } = captureAlertQueue()
    const { workspaceId, jobId } = await seedWorkspaceJob(db)
    await seedRun(db, jobId, workspaceId, new Date('2026-05-10T00:00:00.000Z'))

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
    const { workspaceId, jobId } = await seedWorkspaceJob(db)
    await seedRun(db, jobId, workspaceId, new Date('2026-05-11T23:00:00.000Z'))
    const ruleId = await seedRule(db, { scope: 'workspace', workspaceId, minutes: 24 * 60 })

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
    const { workspaceId, jobId } = await seedWorkspaceJob(db)
    await seedRun(db, jobId, workspaceId, new Date('2026-05-11T23:00:00.000Z'))
    await seedRule(db, { scope: 'workspace', workspaceId, minutes: 24 * 60 })

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
    await seedRun(db, jobId, workspaceId, new Date('2026-05-13T00:02:00.000Z'))
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
    const { workspaceId } = await seedWorkspaceJob(db)
    await seedRule(db, { scope: 'workspace', workspaceId, minutes: 60 })

    await evaluateMissedSchedules({
      db,
      alertQueue: queue,
      now: () => new Date('2026-05-10T02:00:00.000Z'),
    })

    expect(sent).toHaveLength(1)
    expect(sent[0]).toMatchObject({ lastRunAt: null })
  })

  it('keeps workspace-scoped rules inside their Workspace', async () => {
    const db = createTestDb()
    const { queue, sent } = captureAlertQueue()
    const acme = await seedWorkspaceJob(db, 'acme')
    const beta = await seedWorkspaceJob(db, 'beta')
    await seedRule(db, { scope: 'workspace', workspaceId: acme.workspaceId, minutes: 24 * 60 })

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
