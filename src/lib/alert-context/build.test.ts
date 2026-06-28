import { describe, expect, it } from 'vitest'
import type { attempts, jobs, runs, targets, workspaces } from '@/lib/db/schema'
import { buildAlertContext, buildMissedAlertContext, buildSyntheticTestContext } from './build'

type RunRow = typeof runs.$inferSelect
type AttemptRow = typeof attempts.$inferSelect
type JobRow = typeof jobs.$inferSelect
type WorkspaceRow = typeof workspaces.$inferSelect
type TargetRow = typeof targets.$inferSelect

function makeRun(overrides: Partial<RunRow> = {}): RunRow {
  return {
    id: 'run_123',
    jobId: 'job_1',
    workspaceId: 'cust_1',
    scheduledAt: new Date('2026-05-12T00:00:00Z'),
    startedAt: new Date('2026-05-12T00:00:01Z'),
    completedAt: new Date('2026-05-12T00:00:04Z'),
    status: 'completed',
    outcome: 'failure',
    triggerSource: 'cron',
    skippedReason: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

function makeAttempt(num: number, failureKind: AttemptRow['failureKind'] = null): AttemptRow {
  return {
    id: `att_${num}`,
    runId: 'run_123',
    attemptNumber: num,
    startedAt: new Date(),
    completedAt: new Date(),
    httpStatus: null,
    failureKind,
    requestBodyR2Key: null,
    responseBodyR2Key: null,
    requestHeadersJson: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

const job: JobRow = {
  id: 'job_1',
  workspaceId: 'cust_1',
  targetId: 'tgt_1',
  name: 'Daily backup',
  slug: 'daily-backup',
  triggerKind: 'cron',
  cronExpression: '0 9 * * *',
  intervalSeconds: null,
  triggerTimezone: 'UTC',
  bodyTemplate: '',
  headersTemplate: '{}',
  variables: {},
  lastFireAt: null,
  lastMissedAlertAt: null,
  nextFireAt: null,
  fireInProgress: false,
  maxAttempts: 3,
  overallDeadlineMs: 60_000,
  status: 'active',
  createdAt: new Date(),
  updatedAt: new Date(),
}

const workspace: WorkspaceRow = {
  id: 'cust_1',
  name: 'Acme',
  slug: 'acme',
  timezone: 'America/New_York',
  autotaskCompanyId: null,
  status: 'active',
  variables: {},
  seedTag: null,
  createdAt: new Date(),
  updatedAt: new Date(),
}

const target: TargetRow = {
  id: 'tgt_1',
  workspaceId: 'cust_1',
  name: 'API',
  slug: 'api',
  url: 'https://api.example.com',
  method: 'POST',
  authKind: 'none',
  authConfig: null,
  reachability: 'public',
  tunnelId: null,
  internalOrigin: null,
  originHostHeader: null,
  originServerName: null,
  originNoTlsVerify: false,
  status: 'active',
  createdAt: new Date(),
  updatedAt: new Date(),
}

describe('buildAlertContext', () => {
  it('populates the full field map', () => {
    const ctx = buildAlertContext({
      run: makeRun(),
      attempts: [makeAttempt(1, 'http_5xx'), makeAttempt(2, 'http_5xx')],
      job,
      workspace,
      target,
      ruleName: 'Alert on first failure',
      ruleKind: 'first_failure',
      appOrigin: 'https://boop.example.com',
    })
    expect(ctx).toMatchObject({
      kind: 'run',
      workspace_name: 'Acme',
      job_slug: 'daily-backup',
      run_url: 'https://boop.example.com/jobs/daily-backup/runs/run_123',
      duration_ms: 3000,
      attempt_count: 2,
      failure_kind: 'http_5xx',
      test: false,
    })
  })

  it('returns null failure_kind on success', () => {
    const ctx = buildAlertContext({
      run: makeRun({ outcome: 'success' }),
      attempts: [makeAttempt(1)],
      job,
      workspace,
      target,
      ruleName: 'r',
      ruleKind: 'recovery',
      appOrigin: 'https://x',
    })
    expect(ctx.kind).toBe('run')
    if (ctx.kind !== 'run') throw new Error('expected run context')
    expect(ctx.failure_kind).toBeNull()
  })

  it('attempt_count reflects array length, not highest number', () => {
    const ctx = buildAlertContext({
      run: makeRun(),
      attempts: [makeAttempt(3)],
      job,
      workspace,
      target,
      ruleName: 'r',
      ruleKind: 'first_failure',
      appOrigin: 'https://x',
    })
    expect(ctx.kind).toBe('run')
    if (ctx.kind !== 'run') throw new Error('expected run context')
    expect(ctx.attempt_count).toBe(1)
  })
})

describe('buildMissedAlertContext', () => {
  it('populates Job-centered context without Run fields', () => {
    const ctx = buildMissedAlertContext({
      job,
      workspace,
      ruleName: 'Silence alert',
      appOrigin: 'https://boop.example.com',
      lastRunAt: '2026-05-10T00:00:00.000Z',
      silenceThresholdMinutes: 60,
    })
    expect(ctx).toMatchObject({
      kind: 'missed',
      workspace_name: 'Acme',
      job_url: 'https://boop.example.com/jobs/daily-backup',
      rule_kind: 'missed_schedule',
      last_run_at: '2026-05-10T00:00:00.000Z',
      silence_threshold_minutes: 60,
      trigger_source: 'cron',
      schedule: '0 9 * * *',
    })
  })
})

describe('buildSyntheticTestContext', () => {
  it('marks test=true with synthetic identifiers', () => {
    const ctx = buildSyntheticTestContext('Ops Teams', 'ops-teams', 'Acme', 'acme', 'https://b')
    expect(ctx.kind).toBe('run')
    if (ctx.kind !== 'run') throw new Error('expected run context')
    expect(ctx.test).toBe(true)
    expect(ctx.run_id).toBe('test_ops-teams')
  })
})
