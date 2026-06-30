import type { attempts, jobs, runs, targets, workspaces } from '@/lib/db/schema'
import type { AlertContext } from '@/shared/schemas/alert-context'
import type { AlertRuleKind } from '@/shared/schemas/alert-rule'

type RunRow = typeof runs.$inferSelect
type AttemptRow = typeof attempts.$inferSelect
type JobRow = typeof jobs.$inferSelect
type WorkspaceRow = typeof workspaces.$inferSelect
type TargetRow = typeof targets.$inferSelect

interface BuildAlertContextInput {
  run: RunRow
  attempts: readonly AttemptRow[]
  job: JobRow
  workspace: WorkspaceRow
  target: TargetRow
  ruleName: string
  ruleKind: AlertRuleKind
  appOrigin: string
  test?: boolean
}

function runUrl(origin: string, jobSlug: string, runId: string): string {
  return `${origin}/jobs/${jobSlug}/runs/${runId}`
}

function jobUrl(origin: string, jobSlug: string): string {
  return `${origin}/jobs/${jobSlug}`
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
  workspace,
  target,
  ruleName,
  ruleKind,
  appOrigin,
  test = false,
}: BuildAlertContextInput): AlertContext {
  return {
    kind: 'run',
    workspace_name: workspace.name,
    workspace_slug: workspace.slug,
    job_name: job.name,
    job_slug: job.slug,
    target_name: target.name,
    target_url: target.url,
    run_id: run.id,
    run_url: runUrl(appOrigin, job.slug, run.id),
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

interface BuildMissedAlertContextInput {
  job: JobRow
  workspace: WorkspaceRow
  ruleName: string
  appOrigin: string
  lastRunAt: string | null
  silenceThresholdMinutes: number
}

function scheduleOf(job: JobRow): string {
  if (job.triggerKind === 'cron') return job.cronExpression ?? 'cron'
  if (job.triggerKind === 'interval') return `${job.intervalSeconds ?? 0}s interval`
  if (job.triggerKind === 'manual') return 'manual'
  return 'webhook'
}

export function buildMissedAlertContext({
  job,
  workspace,
  ruleName,
  appOrigin,
  lastRunAt,
  silenceThresholdMinutes,
}: BuildMissedAlertContextInput): AlertContext {
  return {
    kind: 'missed',
    workspace_name: workspace.name,
    workspace_slug: workspace.slug,
    job_name: job.name,
    job_slug: job.slug,
    job_url: jobUrl(appOrigin, job.slug),
    rule_name: ruleName,
    rule_kind: 'missed_schedule',
    last_run_at: lastRunAt,
    silence_threshold_minutes: silenceThresholdMinutes,
    trigger_source: job.triggerKind,
    schedule: scheduleOf(job),
    test: false,
  }
}

const TEST_ISO = '2026-05-12T00:00:00.000Z'

export function buildSyntheticTestContext(
  channelName: string,
  channelSlug: string,
  workspaceName: string,
  workspaceSlug: string,
  appOrigin: string,
): AlertContext {
  return {
    kind: 'run',
    workspace_name: workspaceName,
    workspace_slug: workspaceSlug,
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
