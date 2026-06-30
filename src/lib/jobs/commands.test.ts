import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import type { Database } from '@/lib/db/client'
import { jobs } from '@/lib/db/schema'
import { createTestDb } from '@/lib/db/test-db'
import type { DispatchMessage } from '@/lib/dispatch/scheduled'
import { FieldValidationError, NotFoundError } from '@/lib/errors'
import { createTarget } from '@/lib/targets/commands'
import { createWorkspace } from '@/lib/workspaces/commands'
import {
  archiveJob,
  createJob,
  type JobsDeps,
  pauseJob,
  restoreJob,
  resumeJob,
  runJobNow,
  updateJob,
} from './commands'

function createCaptureQueue() {
  const sent: DispatchMessage[] = []
  const queue = {
    async send(body: DispatchMessage) {
      sent.push(body)
    },
    async sendBatch() {},
  }
  return { queue: queue as unknown as Queue<DispatchMessage>, sent }
}

function createTriggerCapture() {
  const calls: { kind: 'interval' | 'cron' | 'webhook' | 'manual'; jobId: string }[] = []
  return {
    calls,
    enterIntervalMode: async (jobId: string) => {
      calls.push({ kind: 'interval', jobId })
    },
    enterCronMode: async (jobId: string) => {
      calls.push({ kind: 'cron', jobId })
    },
    enterWebhookMode: async (jobId: string) => {
      calls.push({ kind: 'webhook', jobId })
    },
    enterManualMode: async (jobId: string) => {
      calls.push({ kind: 'manual', jobId })
    },
  }
}

async function makeDeps(db: Database): Promise<{
  deps: JobsDeps
  sent: DispatchMessage[]
  triggerCalls: { kind: 'interval' | 'cron' | 'webhook' | 'manual'; jobId: string }[]
}> {
  const { queue, sent } = createCaptureQueue()
  const triggers = createTriggerCapture()
  return {
    deps: {
      db,
      dispatchQueue: queue,
      enterIntervalMode: triggers.enterIntervalMode,
      enterCronMode: triggers.enterCronMode,
      enterWebhookMode: triggers.enterWebhookMode,
      enterManualMode: triggers.enterManualMode,
    },
    sent,
    triggerCalls: triggers.calls,
  }
}

async function seedWorkspaceAndTarget(db: Database) {
  await createWorkspace(db, { name: 'Acme', slug: 'acme', timezone: 'America/New_York' })
  await createTarget(db, 'acme', {
    name: 'API',
    slug: 'api',
    url: 'https://api.example.com/ping',
    method: 'POST',
    authKind: 'none',
    reachability: 'public',
  })
}

const baseCreateInput = {
  name: 'Daily Health Check',
  slug: 'daily-health-check',
  targetSlug: 'api',
  bodyTemplate: '',
  headersTemplate: '{}',
  maxAttempts: 3,
  overallDeadlineMs: 60_000,
}

describe('createJob', () => {
  it('inserts a cron Job and does not seed an alarm', async () => {
    const db = createTestDb()
    await seedWorkspaceAndTarget(db)
    const { deps, triggerCalls } = await makeDeps(db)
    const job = await createJob(deps, 'acme', {
      ...baseCreateInput,
      trigger: {
        triggerKind: 'cron',
        cronExpression: '0 9 * * 1-5',
        triggerTimezone: 'America/New_York',
      },
    })
    expect(job.triggerKind).toBe('cron')
    expect(job.cronExpression).toBe('0 9 * * 1-5')
    expect(job.intervalSeconds).toBeNull()
    expect(triggerCalls).toHaveLength(0)
  })

  it('inserts an interval Job and seeds the alarm', async () => {
    const db = createTestDb()
    await seedWorkspaceAndTarget(db)
    const { deps, triggerCalls } = await makeDeps(db)
    const job = await createJob(deps, 'acme', {
      ...baseCreateInput,
      slug: 'every-minute',
      trigger: { triggerKind: 'interval', intervalSeconds: 60 },
    })
    expect(job.intervalSeconds).toBe(60)
    expect(triggerCalls).toEqual([{ kind: 'interval', jobId: job.id }])
  })

  it('inserts a webhook Job and does not seed an alarm', async () => {
    const db = createTestDb()
    await seedWorkspaceAndTarget(db)
    const { deps, triggerCalls } = await makeDeps(db)
    const job = await createJob(deps, 'acme', {
      ...baseCreateInput,
      slug: 'webhook-job',
      trigger: { triggerKind: 'webhook' },
    })
    expect(job.triggerKind).toBe('webhook')
    expect(triggerCalls).toHaveLength(0)
  })

  it('rejects an unknown targetSlug as a field error', async () => {
    const db = createTestDb()
    await seedWorkspaceAndTarget(db)
    const { deps } = await makeDeps(db)
    let thrown: unknown
    try {
      await createJob(deps, 'acme', {
        ...baseCreateInput,
        targetSlug: 'missing',
        trigger: { triggerKind: 'webhook' },
      })
    } catch (err) {
      thrown = err
    }
    expect(thrown).toBeInstanceOf(FieldValidationError)
    expect((thrown as FieldValidationError).fieldErrors).toHaveProperty('targetSlug')
  })

  it('rejects duplicate job slugs within the same workspace', async () => {
    const db = createTestDb()
    await seedWorkspaceAndTarget(db)
    const { deps } = await makeDeps(db)
    await createJob(deps, 'acme', { ...baseCreateInput, trigger: { triggerKind: 'webhook' } })
    let thrown: unknown
    try {
      await createJob(deps, 'acme', { ...baseCreateInput, trigger: { triggerKind: 'webhook' } })
    } catch (err) {
      thrown = err
    }
    expect(thrown).toBeInstanceOf(FieldValidationError)
    expect((thrown as FieldValidationError).fieldErrors).toHaveProperty('slug')
  })
})

describe('updateJob trigger transitions', () => {
  it('cron → interval clears cron columns and seeds alarm', async () => {
    const db = createTestDb()
    await seedWorkspaceAndTarget(db)
    const { deps, triggerCalls } = await makeDeps(db)
    await createJob(deps, 'acme', {
      ...baseCreateInput,
      trigger: {
        triggerKind: 'cron',
        cronExpression: '0 9 * * *',
        triggerTimezone: 'UTC',
      },
    })
    triggerCalls.length = 0
    const updated = await updateJob(deps, 'acme', 'daily-health-check', {
      name: baseCreateInput.name,
      targetSlug: 'api',
      bodyTemplate: '',
      headersTemplate: '{}',
      maxAttempts: 3,
      overallDeadlineMs: 60_000,
      trigger: { triggerKind: 'interval', intervalSeconds: 120 },
    })
    expect(updated.triggerKind).toBe('interval')
    expect(updated.cronExpression).toBeNull()
    expect(updated.triggerTimezone).toBeNull()
    expect(updated.intervalSeconds).toBe(120)
    expect(triggerCalls).toEqual([{ kind: 'interval', jobId: updated.id }])
  })

  it('interval → webhook clears interval column and enters webhook mode', async () => {
    const db = createTestDb()
    await seedWorkspaceAndTarget(db)
    const { deps, triggerCalls } = await makeDeps(db)
    await createJob(deps, 'acme', {
      ...baseCreateInput,
      trigger: { triggerKind: 'interval', intervalSeconds: 60 },
    })
    triggerCalls.length = 0
    const updated = await updateJob(deps, 'acme', 'daily-health-check', {
      name: baseCreateInput.name,
      targetSlug: 'api',
      bodyTemplate: '',
      headersTemplate: '{}',
      maxAttempts: 3,
      overallDeadlineMs: 60_000,
      trigger: { triggerKind: 'webhook' },
    })
    expect(updated.intervalSeconds).toBeNull()
    expect(updated.triggerTimezone).toBeNull()
    expect(triggerCalls).toEqual([{ kind: 'webhook', jobId: updated.id }])
  })

  it('interval → interval with the same seconds is a no-op for the planner', async () => {
    const db = createTestDb()
    await seedWorkspaceAndTarget(db)
    const { deps, triggerCalls } = await makeDeps(db)
    const job = await createJob(deps, 'acme', {
      ...baseCreateInput,
      trigger: { triggerKind: 'interval', intervalSeconds: 60 },
    })
    triggerCalls.length = 0
    await updateJob(deps, 'acme', job.slug, {
      name: 'Renamed',
      targetSlug: 'api',
      bodyTemplate: '',
      headersTemplate: '{}',
      maxAttempts: 3,
      overallDeadlineMs: 60_000,
      trigger: { triggerKind: 'interval', intervalSeconds: 60 },
    })
    expect(triggerCalls).toHaveLength(0)
  })
})

describe('pauseJob / resumeJob / archiveJob / restoreJob', () => {
  it('pause and resume do not invoke trigger-mode helpers', async () => {
    const db = createTestDb()
    await seedWorkspaceAndTarget(db)
    const { deps, triggerCalls } = await makeDeps(db)
    await createJob(deps, 'acme', {
      ...baseCreateInput,
      trigger: { triggerKind: 'interval', intervalSeconds: 60 },
    })
    triggerCalls.length = 0
    const paused = await pauseJob(deps, 'acme', 'daily-health-check')
    expect(paused.status).toBe('paused')
    const resumed = await resumeJob(deps, 'acme', 'daily-health-check')
    expect(resumed.status).toBe('active')
    expect(triggerCalls).toHaveLength(0)
  })

  it('archiveJob marks status archived without re-seeding', async () => {
    const db = createTestDb()
    await seedWorkspaceAndTarget(db)
    const { deps, triggerCalls } = await makeDeps(db)
    await createJob(deps, 'acme', {
      ...baseCreateInput,
      trigger: { triggerKind: 'interval', intervalSeconds: 60 },
    })
    triggerCalls.length = 0
    const archived = await archiveJob(deps, 'acme', 'daily-health-check')
    expect(archived.status).toBe('archived')
    expect(triggerCalls).toHaveLength(0)
  })

  it('restoreJob on an interval Job re-arms the DO alarm', async () => {
    const db = createTestDb()
    await seedWorkspaceAndTarget(db)
    const { deps, triggerCalls } = await makeDeps(db)
    const job = await createJob(deps, 'acme', {
      ...baseCreateInput,
      trigger: { triggerKind: 'interval', intervalSeconds: 60 },
    })
    await archiveJob(deps, 'acme', 'daily-health-check')
    triggerCalls.length = 0
    const restored = await restoreJob(deps, 'acme', 'daily-health-check')
    expect(restored.status).toBe('active')
    expect(triggerCalls).toEqual([{ kind: 'interval', jobId: job.id }])
  })

  it('restoreJob on a cron Job does not re-seed', async () => {
    const db = createTestDb()
    await seedWorkspaceAndTarget(db)
    const { deps, triggerCalls } = await makeDeps(db)
    await createJob(deps, 'acme', {
      ...baseCreateInput,
      trigger: {
        triggerKind: 'cron',
        cronExpression: '0 9 * * *',
        triggerTimezone: 'UTC',
      },
    })
    await archiveJob(deps, 'acme', 'daily-health-check')
    triggerCalls.length = 0
    const restored = await restoreJob(deps, 'acme', 'daily-health-check')
    expect(restored.status).toBe('active')
    expect(triggerCalls).toHaveLength(0)
  })
})

describe('runJobNow', () => {
  it('pushes the exact { jobId, scheduledAt } shape onto DISPATCH_QUEUE', async () => {
    const db = createTestDb()
    await seedWorkspaceAndTarget(db)
    const { deps, sent } = await makeDeps(db)
    const job = await createJob(deps, 'acme', {
      ...baseCreateInput,
      trigger: { triggerKind: 'webhook' },
    })
    await runJobNow(deps, 'acme', 'daily-health-check')
    expect(sent).toHaveLength(1)
    expect(sent[0]?.jobId).toBe(job.id)
    expect(sent[0]?.scheduledAt).toBeInstanceOf(Date)
  })

  it('rejects on a paused Job with a field error', async () => {
    const db = createTestDb()
    await seedWorkspaceAndTarget(db)
    const { deps, sent } = await makeDeps(db)
    await createJob(deps, 'acme', {
      ...baseCreateInput,
      trigger: { triggerKind: 'webhook' },
    })
    await pauseJob(deps, 'acme', 'daily-health-check')
    let thrown: unknown
    try {
      await runJobNow(deps, 'acme', 'daily-health-check')
    } catch (err) {
      thrown = err
    }
    expect(thrown).toBeInstanceOf(FieldValidationError)
    expect(sent).toHaveLength(0)
  })

  it('rejects when the Job does not exist', async () => {
    const db = createTestDb()
    await seedWorkspaceAndTarget(db)
    const { deps } = await makeDeps(db)
    await expect(runJobNow(deps, 'acme', 'missing')).rejects.toBeInstanceOf(NotFoundError)
  })

  it('lastFireAt and nextFireAt round-trip nullable for a new webhook Job', async () => {
    const db = createTestDb()
    await seedWorkspaceAndTarget(db)
    const { deps } = await makeDeps(db)
    const job = await createJob(deps, 'acme', {
      ...baseCreateInput,
      trigger: { triggerKind: 'webhook' },
    })
    expect(job.lastFireAt).toBeNull()
    expect(job.nextFireAt).toBeNull()
    const [row] = await db.select().from(jobs).where(eq(jobs.id, job.id))
    expect(row?.triggerKind).toBe('webhook')
  })
})
