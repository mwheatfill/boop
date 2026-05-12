import { describe, expect, it } from 'vitest'
import type { attempts, customers, jobs, runs, targets } from '@/lib/db/schema'
import { buildAlertContext, buildSyntheticTestContext } from './build'

type RunRow = typeof runs.$inferSelect
type AttemptRow = typeof attempts.$inferSelect
type JobRow = typeof jobs.$inferSelect
type CustomerRow = typeof customers.$inferSelect
type TargetRow = typeof targets.$inferSelect

function makeRun(overrides: Partial<RunRow> = {}): RunRow {
  return {
    id: 'run_123',
    jobId: 'job_1',
    customerId: 'cust_1',
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
  customerId: 'cust_1',
  targetId: 'tgt_1',
  name: 'Daily backup',
  slug: 'daily-backup',
  triggerKind: 'cron',
  cronExpression: '0 9 * * *',
  intervalSeconds: null,
  triggerTimezone: 'UTC',
  bodyTemplate: '',
  headersTemplate: '{}',
  lastFireAt: null,
  nextFireAt: null,
  fireInProgress: false,
  maxAttempts: 3,
  overallDeadlineMs: 60_000,
  status: 'active',
  createdAt: new Date(),
  updatedAt: new Date(),
}

const customer: CustomerRow = {
  id: 'cust_1',
  name: 'Acme',
  slug: 'acme',
  timezone: 'America/New_York',
  autotaskCompanyId: null,
  status: 'active',
  createdAt: new Date(),
  updatedAt: new Date(),
}

const target: TargetRow = {
  id: 'tgt_1',
  customerId: 'cust_1',
  name: 'API',
  slug: 'api',
  url: 'https://api.example.com',
  method: 'POST',
  authKind: 'none',
  authConfig: null,
  reachability: 'public',
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
      customer,
      target,
      ruleName: 'Alert on first failure',
      ruleKind: 'first_failure',
      appOrigin: 'https://boop.example.com',
    })
    expect(ctx).toMatchObject({
      customer_name: 'Acme',
      job_slug: 'daily-backup',
      run_url: 'https://boop.example.com/customers/acme/jobs/daily-backup/runs/run_123',
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
      customer,
      target,
      ruleName: 'r',
      ruleKind: 'recovery',
      appOrigin: 'https://x',
    })
    expect(ctx.failure_kind).toBeNull()
  })

  it('attempt_count reflects array length, not highest number', () => {
    const ctx = buildAlertContext({
      run: makeRun(),
      attempts: [makeAttempt(3)],
      job,
      customer,
      target,
      ruleName: 'r',
      ruleKind: 'first_failure',
      appOrigin: 'https://x',
    })
    expect(ctx.attempt_count).toBe(1)
  })
})

describe('buildSyntheticTestContext', () => {
  it('marks test=true with synthetic identifiers', () => {
    const ctx = buildSyntheticTestContext('Ops Teams', 'ops-teams', 'Acme', 'acme', 'https://b')
    expect(ctx.test).toBe(true)
    expect(ctx.run_id).toBe('test_ops-teams')
  })
})
