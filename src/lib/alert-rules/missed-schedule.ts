import { and, desc, eq, inArray, isNotNull, or } from 'drizzle-orm'
import { enqueueMissedScheduleAlerts } from '@/lib/alert-queue/producer'
import type { AlertQueueMessage } from '@/lib/alert-queue/types'
import type { Database } from '@/lib/db/client'
import { alertRules, jobs, runs } from '@/lib/db/schema'
import { logInfo } from '@/lib/log'
import { decodeAlertRuleRow } from './decode'

interface MissedCandidate {
  job: typeof jobs.$inferSelect
  ruleId: string
  ruleName: string
  channelIds: string[]
  silenceThresholdMinutes: number
}

export interface MissedScheduleDeps {
  db: Database
  alertQueue: Queue<AlertQueueMessage>
  now?: () => Date
}

export interface MissedScheduleResult {
  evaluatedJobs: number
  firingRules: number
  enqueued: number
}

function parseCandidate(row: {
  job: typeof jobs.$inferSelect
  rule: typeof alertRules.$inferSelect
}): MissedCandidate | null {
  const rule = decodeAlertRuleRow(row.rule)
  if (!rule || rule.config.kind !== 'missed_schedule') return null
  return {
    job: row.job,
    ruleId: rule.id,
    ruleName: rule.name,
    channelIds: rule.channelIds,
    silenceThresholdMinutes: rule.config.silence_threshold_minutes,
  }
}

async function loadCandidates(db: Database): Promise<MissedCandidate[]> {
  const rows = await db
    .select({ job: jobs, rule: alertRules })
    .from(jobs)
    .innerJoin(
      alertRules,
      and(
        eq(alertRules.status, 'active'),
        eq(alertRules.kind, 'missed_schedule'),
        or(
          and(eq(alertRules.scope, 'workspace'), eq(alertRules.workspaceId, jobs.workspaceId)),
          and(eq(alertRules.scope, 'job'), eq(alertRules.jobId, jobs.id)),
        ),
      ),
    )
    .where(eq(jobs.status, 'active'))
  return rows.flatMap((row) => {
    const parsed = parseCandidate(row)
    return parsed ? [parsed] : []
  })
}

async function loadLastRunAtByJob(
  db: Database,
  jobIds: readonly string[],
): Promise<Map<string, Date | null>> {
  const entries = await Promise.all(
    [...new Set(jobIds)].map(async (jobId) => {
      const [row] = await db
        .select({ startedAt: runs.startedAt })
        .from(runs)
        .where(and(eq(runs.jobId, jobId), isNotNull(runs.startedAt)))
        .orderBy(desc(runs.startedAt))
        .limit(1)
      return [jobId, row?.startedAt ?? null] as const
    }),
  )
  return new Map(entries)
}

function shouldFire(candidate: MissedCandidate, lastRunAt: Date | null, now: Date): boolean {
  const reference = lastRunAt ?? candidate.job.createdAt
  const thresholdMs = candidate.silenceThresholdMinutes * 60_000
  if (now.getTime() - reference.getTime() < thresholdMs) return false
  return !candidate.job.lastMissedAlertAt || candidate.job.lastMissedAlertAt < reference
}

function countEvaluatedJobs(candidates: readonly MissedCandidate[]): number {
  return new Set(candidates.map((candidate) => candidate.job.id)).size
}

export async function evaluateMissedSchedules({
  db,
  alertQueue,
  now = () => new Date(),
}: MissedScheduleDeps): Promise<MissedScheduleResult> {
  const tick = now()
  const candidates = await loadCandidates(db)
  if (candidates.length === 0) return { evaluatedJobs: 0, firingRules: 0, enqueued: 0 }

  const lastRunAtByJob = await loadLastRunAtByJob(
    db,
    candidates.map((candidate) => candidate.job.id),
  )
  const firing = candidates.filter((candidate) =>
    shouldFire(candidate, lastRunAtByJob.get(candidate.job.id) ?? null, tick),
  )

  const evaluatedJobs = countEvaluatedJobs(candidates)
  if (firing.length === 0) {
    return { evaluatedJobs, firingRules: 0, enqueued: 0 }
  }

  const enqueued = await enqueueMissedScheduleAlerts(
    alertQueue,
    firing.map((candidate) => ({
      jobId: candidate.job.id,
      ruleId: candidate.ruleId,
      ruleName: candidate.ruleName,
      channelIds: candidate.channelIds,
      lastRunAt: lastRunAtByJob.get(candidate.job.id) ?? null,
      silenceThresholdMinutes: candidate.silenceThresholdMinutes,
    })),
  )
  const firedJobIds = [...new Set(firing.map((candidate) => candidate.job.id))]
  await db
    .update(jobs)
    .set({ lastMissedAlertAt: tick, updatedAt: tick })
    .where(inArray(jobs.id, firedJobIds))

  const result = {
    evaluatedJobs,
    firingRules: firing.length,
    enqueued,
  }
  logInfo('alert.missed_schedule_evaluated', result)
  return result
}
