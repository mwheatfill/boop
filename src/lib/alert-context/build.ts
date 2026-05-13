import type { attempts, customers, jobs, runs, targets } from '@/lib/db/schema'
import type { AlertContext } from '@/shared/schemas/alert-context'
import type { AlertRuleKind } from '@/shared/schemas/alert-rule'

type RunRow = typeof runs.$inferSelect
type AttemptRow = typeof attempts.$inferSelect
type JobRow = typeof jobs.$inferSelect
type CustomerRow = typeof customers.$inferSelect
type TargetRow = typeof targets.$inferSelect

interface BuildAlertContextInput {
  run: RunRow
  attempts: readonly AttemptRow[]
  job: JobRow
  customer: CustomerRow
  target: TargetRow
  ruleName: string
  ruleKind: AlertRuleKind
  appOrigin: string
  test?: boolean
}

function runUrl(origin: string, customerSlug: string, jobSlug: string, runId: string): string {
  return `${origin}/customers/${customerSlug}/jobs/${jobSlug}/runs/${runId}`
}

function durationMsOf(run: RunRow): number {
  if (!run.startedAt || !run.completedAt) return 0
  return run.completedAt.getTime() - run.startedAt.getTime()
}

function failureKindOf(run: RunRow, attempts: readonly AttemptRow[]): string | null {
  if (run.outcome === 'success' || run.outcome === null) return null
  const last = attempts.reduce<AttemptRow | undefined>(
    (latest, attempt) =>
      latest && latest.attemptNumber > attempt.attemptNumber ? latest : attempt,
    undefined,
  )
  return last?.failureKind ?? null
}

export function buildAlertContext({
  run,
  attempts,
  job,
  customer,
  target,
  ruleName,
  ruleKind,
  appOrigin,
  test = false,
}: BuildAlertContextInput): AlertContext {
  return {
    customer_name: customer.name,
    customer_slug: customer.slug,
    job_name: job.name,
    job_slug: job.slug,
    target_name: target.name,
    target_url: target.url,
    run_id: run.id,
    run_url: runUrl(appOrigin, customer.slug, job.slug, run.id),
    outcome: run.outcome ?? 'unknown',
    started_at: run.startedAt?.toISOString() ?? '',
    completed_at: run.completedAt?.toISOString() ?? '',
    duration_ms: durationMsOf(run),
    attempt_count: attempts.length,
    trigger_source: run.triggerSource,
    failure_kind: failureKindOf(run, attempts),
    rule_name: ruleName,
    rule_kind: ruleKind,
    test,
  }
}

const TEST_ISO = '2026-05-12T00:00:00.000Z'

export function buildSyntheticTestContext(
  channelName: string,
  channelSlug: string,
  customerName: string,
  customerSlug: string,
  appOrigin: string,
): AlertContext {
  return {
    customer_name: customerName,
    customer_slug: customerSlug,
    job_name: `boop test alert (${channelName})`,
    job_slug: `test-${channelSlug}`,
    target_name: 'boop',
    target_url: appOrigin,
    run_id: `test_${channelSlug}`,
    run_url: appOrigin,
    outcome: 'success',
    started_at: TEST_ISO,
    completed_at: TEST_ISO,
    duration_ms: 0,
    attempt_count: 1,
    trigger_source: 'manual',
    failure_kind: null,
    rule_name: 'Channel test',
    rule_kind: 'first_failure',
    test: true,
  }
}
