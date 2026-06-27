import { describe, expect, it } from 'vitest'
import { newId } from '@/lib/db/ids'
import { alertRules, channels, jobs, targets, workspaces } from '@/lib/db/schema'
import { createTestDb } from '@/lib/db/test-db'
import { canArchiveChannel, canArchiveTarget, canArchiveWorkspace } from './archive-policy'

async function seedWorkspace(db: ReturnType<typeof createTestDb>) {
  const id = newId('cust')
  await db.insert(workspaces).values({
    id,
    name: 'Acme',
    slug: 'acme',
    timezone: 'UTC',
  })
  return id
}

async function seedTarget(db: ReturnType<typeof createTestDb>, workspaceId: string) {
  const id = newId('tgt')
  await db.insert(targets).values({
    id,
    workspaceId,
    name: 'API',
    slug: 'api',
    url: 'https://example.com',
    method: 'POST',
  })
  return id
}

async function seedJob(
  db: ReturnType<typeof createTestDb>,
  workspaceId: string,
  targetId: string,
  status: 'active' | 'paused' | 'archived',
  slug = `job-${status}`,
) {
  const id = newId('job')
  await db.insert(jobs).values({
    id,
    workspaceId,
    targetId,
    name: `Job ${status}`,
    slug,
    triggerKind: 'cron',
    cronExpression: '* * * * *',
    triggerTimezone: 'UTC',
    status,
  })
  return id
}

async function seedChannel(db: ReturnType<typeof createTestDb>, workspaceId: string) {
  const id = newId('chn')
  await db.insert(channels).values({ id, workspaceId, kind: 'webhook', name: 'Ops', slug: 'ops' })
  return id
}

describe('canArchiveWorkspace', () => {
  it('returns ok when the workspace has no jobs', async () => {
    const db = createTestDb()
    const workspaceId = await seedWorkspace(db)
    await expect(canArchiveWorkspace(db, workspaceId)).resolves.toEqual({ ok: true })
  })

  it('returns ok when the workspace only has archived jobs', async () => {
    const db = createTestDb()
    const workspaceId = await seedWorkspace(db)
    const targetId = await seedTarget(db, workspaceId)
    await seedJob(db, workspaceId, targetId, 'archived')
    await expect(canArchiveWorkspace(db, workspaceId)).resolves.toEqual({ ok: true })
  })

  it('blocks when the workspace has an active job', async () => {
    const db = createTestDb()
    const workspaceId = await seedWorkspace(db)
    const targetId = await seedTarget(db, workspaceId)
    await seedJob(db, workspaceId, targetId, 'active')
    await expect(canArchiveWorkspace(db, workspaceId)).resolves.toEqual({
      ok: false,
      reason: 'has_active_jobs',
      blockingCount: 1,
    })
  })

  it('blocks when the workspace has a paused job (paused counts as non-archived)', async () => {
    const db = createTestDb()
    const workspaceId = await seedWorkspace(db)
    const targetId = await seedTarget(db, workspaceId)
    await seedJob(db, workspaceId, targetId, 'paused')
    await expect(canArchiveWorkspace(db, workspaceId)).resolves.toEqual({
      ok: false,
      reason: 'has_active_jobs',
      blockingCount: 1,
    })
  })

  it('counts the blocking job total accurately', async () => {
    const db = createTestDb()
    const workspaceId = await seedWorkspace(db)
    const targetId = await seedTarget(db, workspaceId)
    await seedJob(db, workspaceId, targetId, 'active', 'job-a')
    await seedJob(db, workspaceId, targetId, 'paused', 'job-b')
    await seedJob(db, workspaceId, targetId, 'archived', 'job-c')
    await expect(canArchiveWorkspace(db, workspaceId)).resolves.toEqual({
      ok: false,
      reason: 'has_active_jobs',
      blockingCount: 2,
    })
  })

  it('scopes the check to the asked-about workspace only', async () => {
    const db = createTestDb()
    const first = await seedWorkspace(db)
    const second = newId('cust')
    await db.insert(workspaces).values({
      id: second,
      name: 'Beta',
      slug: 'beta',
      timezone: 'UTC',
    })
    const targetId = await seedTarget(db, first)
    await seedJob(db, first, targetId, 'active')
    await expect(canArchiveWorkspace(db, second)).resolves.toEqual({ ok: true })
  })
})

describe('canArchiveTarget', () => {
  it('returns ok when the target has no jobs', async () => {
    const db = createTestDb()
    const workspaceId = await seedWorkspace(db)
    const targetId = await seedTarget(db, workspaceId)
    await expect(canArchiveTarget(db, targetId)).resolves.toEqual({ ok: true })
  })

  it('returns ok when all jobs referencing the target are archived', async () => {
    const db = createTestDb()
    const workspaceId = await seedWorkspace(db)
    const targetId = await seedTarget(db, workspaceId)
    await seedJob(db, workspaceId, targetId, 'archived')
    await expect(canArchiveTarget(db, targetId)).resolves.toEqual({ ok: true })
  })

  it('blocks when an active or paused job references the target', async () => {
    const db = createTestDb()
    const workspaceId = await seedWorkspace(db)
    const targetId = await seedTarget(db, workspaceId)
    await seedJob(db, workspaceId, targetId, 'active', 'job-a')
    await seedJob(db, workspaceId, targetId, 'paused', 'job-b')
    await seedJob(db, workspaceId, targetId, 'archived', 'job-c')
    await expect(canArchiveTarget(db, targetId)).resolves.toEqual({
      ok: false,
      reason: 'has_active_jobs',
      blockingCount: 2,
    })
  })
})

describe('canArchiveChannel', () => {
  it('returns ok when no active rule references the channel', async () => {
    const db = createTestDb()
    const workspaceId = await seedWorkspace(db)
    const channelId = await seedChannel(db, workspaceId)
    await expect(canArchiveChannel(db, channelId)).resolves.toEqual({ ok: true })
  })

  it('blocks when a workspace-scoped rule references the channel', async () => {
    const db = createTestDb()
    const workspaceId = await seedWorkspace(db)
    const channelId = await seedChannel(db, workspaceId)
    await db.insert(alertRules).values({
      id: newId('rul'),
      scope: 'workspace',
      workspaceId,
      kind: 'first_failure',
      name: 'WS rule',
      slug: 'ws-rule',
      channelIds: JSON.stringify([channelId]),
    })
    await expect(canArchiveChannel(db, channelId)).resolves.toEqual({
      ok: false,
      reason: 'has_active_alert_rules',
      blockingCount: 1,
    })
  })

  it('blocks when a job-scoped rule in the same workspace references the channel', async () => {
    const db = createTestDb()
    const workspaceId = await seedWorkspace(db)
    const targetId = await seedTarget(db, workspaceId)
    const jobId = await seedJob(db, workspaceId, targetId, 'active')
    const channelId = await seedChannel(db, workspaceId)
    await db.insert(alertRules).values({
      id: newId('rul'),
      scope: 'job',
      jobId,
      kind: 'first_failure',
      name: 'Job rule',
      slug: 'job-rule',
      channelIds: JSON.stringify([channelId]),
    })
    await expect(canArchiveChannel(db, channelId)).resolves.toEqual({
      ok: false,
      reason: 'has_active_alert_rules',
      blockingCount: 1,
    })
  })
})
