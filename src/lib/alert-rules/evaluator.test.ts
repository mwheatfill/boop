import { describe, expect, it } from 'vitest'
import type { Database } from '@/lib/db/client'
import { newId } from '@/lib/db/ids'
import { alertRules, jobs, runs, targets, workspaces } from '@/lib/db/schema'
import { createTestDb } from '@/lib/db/test-db'
import { evaluateRulesForRun } from './evaluator'

async function seedJob(db: Database) {
  const workspaceId = newId('cust')
  await db
    .insert(workspaces)
    .values({ id: workspaceId, name: 'Acme', slug: 'acme', timezone: 'UTC' })
  const targetId = newId('tgt')
  await db.insert(targets).values({
    id: targetId,
    workspaceId,
    name: 'API',
    slug: 'api',
    url: 'https://example.com',
    method: 'POST',
  })
  const jobId = newId('job')
  await db.insert(jobs).values({
    id: jobId,
    workspaceId,
    targetId,
    name: 'Daily',
    slug: 'daily',
    triggerKind: 'cron',
    cronExpression: '* * * * *',
    triggerTimezone: 'UTC',
  })
  return { workspaceId, jobId }
}

async function seedRun(
  db: Database,
  jobId: string,
  workspaceId: string,
  outcome: 'success' | 'failure' | 'timeout' | null,
  startedMs: number,
  durationMs = 1000,
): Promise<string> {
  const runId = newId('run')
  await db.insert(runs).values({
    id: runId,
    jobId,
    workspaceId,
    scheduledAt: new Date(startedMs),
    startedAt: new Date(startedMs),
    completedAt: new Date(startedMs + durationMs),
    status: 'completed',
    outcome,
  })
  return runId
}

async function seedRule(
  db: Database,
  workspaceId: string,
  kind: 'first_failure' | 'consecutive_failures' | 'recovery' | 'slow_run',
  config: object,
  channelIds: string[],
  status: 'active' | 'archived' = 'active',
): Promise<string> {
  const id = newId('rul')
  await db.insert(alertRules).values({
    id,
    scope: 'workspace',
    workspaceId,
    kind,
    name: `${kind} rule`,
    slug: `${kind}-${id.slice(-4)}`,
    config: JSON.stringify(config),
    channelIds: JSON.stringify(channelIds),
    status,
  })
  return id
}

async function seedJobRule(
  db: Database,
  jobId: string,
  kind: 'first_failure' | 'consecutive_failures' | 'recovery' | 'slow_run',
  config: object,
  channelIds: string[],
): Promise<string> {
  const id = newId('rul')
  await db.insert(alertRules).values({
    id,
    scope: 'job',
    jobId,
    kind,
    name: `job ${kind} rule`,
    slug: `job-${kind}-${id.slice(-4)}`,
    config: JSON.stringify(config),
    channelIds: JSON.stringify(channelIds),
    status: 'active',
  })
  return id
}

describe('evaluateRulesForRun', () => {
  it('returns empty when no rules exist', async () => {
    const db = createTestDb()
    const { workspaceId, jobId } = await seedJob(db)
    const runId = await seedRun(db, jobId, workspaceId, 'failure', 1000)
    expect(await evaluateRulesForRun({ db, workspaceId, jobId, runId })).toEqual([])
  })

  it('fires first_failure on failure after success, fanning out to all channels', async () => {
    const db = createTestDb()
    const { workspaceId, jobId } = await seedJob(db)
    await seedRun(db, jobId, workspaceId, 'success', 1000)
    const runId = await seedRun(db, jobId, workspaceId, 'failure', 2000)
    const ruleId = await seedRule(db, workspaceId, 'first_failure', {}, ['chn_a', 'chn_b'])
    const firing = await evaluateRulesForRun({ db, workspaceId, jobId, runId })
    expect(firing).toHaveLength(1)
    expect(firing[0]).toMatchObject({ ruleId, channelIds: ['chn_a', 'chn_b'] })
  })

  it('runs multiple rules in parallel', async () => {
    const db = createTestDb()
    const { workspaceId, jobId } = await seedJob(db)
    await seedRun(db, jobId, workspaceId, 'failure', 1000, 5000)
    await seedRun(db, jobId, workspaceId, 'failure', 10_000, 5000)
    const runId = await seedRun(db, jobId, workspaceId, 'failure', 20_000, 5000)
    await seedRule(db, workspaceId, 'consecutive_failures', { count: 3 }, ['chn_a'])
    await seedRule(db, workspaceId, 'slow_run', { threshold_ms: 1000 }, ['chn_b'])
    expect(await evaluateRulesForRun({ db, workspaceId, jobId, runId })).toHaveLength(2)
  })

  it('excludes archived rules', async () => {
    const db = createTestDb()
    const { workspaceId, jobId } = await seedJob(db)
    await seedRun(db, jobId, workspaceId, 'success', 1000)
    const runId = await seedRun(db, jobId, workspaceId, 'failure', 2000)
    await seedRule(db, workspaceId, 'first_failure', {}, ['chn_a'], 'archived')
    expect(await evaluateRulesForRun({ db, workspaceId, jobId, runId })).toEqual([])
  })

  it('skipped runs in history are filtered by the predicate', async () => {
    const db = createTestDb()
    const { workspaceId, jobId } = await seedJob(db)
    await seedRun(db, jobId, workspaceId, 'success', 1000)
    await seedRun(db, jobId, workspaceId, null, 1500)
    const runId = await seedRun(db, jobId, workspaceId, 'failure', 2000)
    await seedRule(db, workspaceId, 'first_failure', {}, ['chn_a'])
    expect(await evaluateRulesForRun({ db, workspaceId, jobId, runId })).toHaveLength(1)
  })

  it('sizes history fetch by the largest consecutive_failures count', async () => {
    const db = createTestDb()
    const { workspaceId, jobId } = await seedJob(db)
    for (let i = 0; i < 5; i++) await seedRun(db, jobId, workspaceId, 'failure', 1000 + i * 1000)
    const runId = await seedRun(db, jobId, workspaceId, 'failure', 7000)
    await seedRule(db, workspaceId, 'consecutive_failures', { count: 5 }, ['chn_a'])
    expect(await evaluateRulesForRun({ db, workspaceId, jobId, runId })).toHaveLength(1)
  })

  it('unions workspace + job rules; each rule fires independently', async () => {
    const db = createTestDb()
    const { workspaceId, jobId } = await seedJob(db)
    await seedRun(db, jobId, workspaceId, 'success', 1000)
    const runId = await seedRun(db, jobId, workspaceId, 'failure', 2000)
    const wsId = await seedRule(db, workspaceId, 'first_failure', {}, ['chn_ws'])
    const jobScopeId = await seedJobRule(db, jobId, 'first_failure', {}, ['chn_job'])
    const firing = await evaluateRulesForRun({ db, workspaceId, jobId, runId })
    expect(firing.map((f) => f.ruleId).sort()).toEqual([wsId, jobScopeId].sort())
  })

  it('skips Workspace rules for a different Workspace', async () => {
    const db = createTestDb()
    const acme = await seedJob(db)
    const otherWorkspaceId = newId('cust')
    await db.insert(workspaces).values({
      id: otherWorkspaceId,
      name: 'Other',
      slug: 'other',
      timezone: 'UTC',
    })
    await seedRule(db, otherWorkspaceId, 'first_failure', {}, ['chn_other'])
    await seedRun(db, acme.jobId, acme.workspaceId, 'success', 1000)
    const runId = await seedRun(db, acme.jobId, acme.workspaceId, 'failure', 2000)
    expect(
      await evaluateRulesForRun({
        db,
        workspaceId: acme.workspaceId,
        jobId: acme.jobId,
        runId,
      }),
    ).toEqual([])
  })
})
