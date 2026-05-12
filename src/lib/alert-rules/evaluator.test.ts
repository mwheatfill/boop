import { describe, expect, it } from 'vitest'
import type { Database } from '@/lib/db/client'
import { newId } from '@/lib/db/ids'
import { alertRules, customers, jobs, runs, targets } from '@/lib/db/schema'
import { createTestDb } from '@/lib/db/test-db'
import { evaluateRulesForRun } from './evaluator'

async function seedJob(db: Database) {
  const customerId = newId('cust')
  await db.insert(customers).values({ id: customerId, name: 'Acme', slug: 'acme', timezone: 'UTC' })
  const targetId = newId('tgt')
  await db.insert(targets).values({
    id: targetId,
    customerId,
    name: 'API',
    slug: 'api',
    url: 'https://example.com',
    method: 'POST',
  })
  const jobId = newId('job')
  await db.insert(jobs).values({
    id: jobId,
    customerId,
    targetId,
    name: 'Daily',
    slug: 'daily',
    triggerKind: 'cron',
    cronExpression: '* * * * *',
    triggerTimezone: 'UTC',
  })
  return { customerId, jobId }
}

async function seedRun(
  db: Database,
  jobId: string,
  customerId: string,
  outcome: 'success' | 'failure' | 'timeout' | null,
  startedMs: number,
  durationMs = 1000,
): Promise<string> {
  const runId = newId('run')
  await db.insert(runs).values({
    id: runId,
    jobId,
    customerId,
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
  customerId: string,
  kind: 'first_failure' | 'consecutive_failures' | 'recovery' | 'slow_run',
  config: object,
  channelIds: string[],
  status: 'active' | 'archived' = 'active',
): Promise<string> {
  const id = newId('rul')
  await db.insert(alertRules).values({
    id,
    customerId,
    kind,
    name: `${kind} rule`,
    slug: `${kind}-${id.slice(-4)}`,
    config: JSON.stringify(config),
    channelIds: JSON.stringify(channelIds),
    status,
  })
  return id
}

describe('evaluateRulesForRun', () => {
  it('returns empty when no rules exist', async () => {
    const db = createTestDb()
    const { customerId, jobId } = await seedJob(db)
    const runId = await seedRun(db, jobId, customerId, 'failure', 1000)
    expect(await evaluateRulesForRun({ db, customerId, jobId, runId })).toEqual([])
  })

  it('fires first_failure on failure after success, fanning out to all channels', async () => {
    const db = createTestDb()
    const { customerId, jobId } = await seedJob(db)
    await seedRun(db, jobId, customerId, 'success', 1000)
    const runId = await seedRun(db, jobId, customerId, 'failure', 2000)
    const ruleId = await seedRule(db, customerId, 'first_failure', {}, ['chn_a', 'chn_b'])
    const firing = await evaluateRulesForRun({ db, customerId, jobId, runId })
    expect(firing).toHaveLength(1)
    expect(firing[0]).toMatchObject({ ruleId, channelIds: ['chn_a', 'chn_b'] })
  })

  it('runs multiple rules in parallel', async () => {
    const db = createTestDb()
    const { customerId, jobId } = await seedJob(db)
    await seedRun(db, jobId, customerId, 'failure', 1000)
    await seedRun(db, jobId, customerId, 'failure', 2000)
    const runId = await seedRun(db, jobId, customerId, 'failure', 3000)
    await seedRule(db, customerId, 'consecutive_failures', { count: 3 }, ['chn_a'])
    await seedRule(db, customerId, 'slow_run', { threshold_ms: 500 }, ['chn_b'])
    expect(await evaluateRulesForRun({ db, customerId, jobId, runId })).toHaveLength(2)
  })

  it('excludes archived rules', async () => {
    const db = createTestDb()
    const { customerId, jobId } = await seedJob(db)
    await seedRun(db, jobId, customerId, 'success', 1000)
    const runId = await seedRun(db, jobId, customerId, 'failure', 2000)
    await seedRule(db, customerId, 'first_failure', {}, ['chn_a'], 'archived')
    expect(await evaluateRulesForRun({ db, customerId, jobId, runId })).toEqual([])
  })

  it('skipped runs in history are filtered by the predicate', async () => {
    const db = createTestDb()
    const { customerId, jobId } = await seedJob(db)
    await seedRun(db, jobId, customerId, 'success', 1000)
    await seedRun(db, jobId, customerId, null, 1500)
    const runId = await seedRun(db, jobId, customerId, 'failure', 2000)
    await seedRule(db, customerId, 'first_failure', {}, ['chn_a'])
    expect(await evaluateRulesForRun({ db, customerId, jobId, runId })).toHaveLength(1)
  })

  it('sizes history fetch by the largest consecutive_failures count', async () => {
    const db = createTestDb()
    const { customerId, jobId } = await seedJob(db)
    for (let i = 0; i < 5; i++) await seedRun(db, jobId, customerId, 'failure', 1000 + i * 1000)
    const runId = await seedRun(db, jobId, customerId, 'failure', 7000)
    await seedRule(db, customerId, 'consecutive_failures', { count: 5 }, ['chn_a'])
    expect(await evaluateRulesForRun({ db, customerId, jobId, runId })).toHaveLength(1)
  })
})
