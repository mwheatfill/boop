import { and, desc, eq, inArray, isNotNull, or } from 'drizzle-orm'
import { enqueueAlertBatch } from '@/lib/alert-queue/producer'
import type { AlertQueueMessage } from '@/lib/alert-queue/types'
import type { Database } from '@/lib/db/client'
import { alertRules, jobs, runs } from '@/lib/db/schema'
import { logError, logInfo } from '@/lib/log'
import { AlertRuleConfigSchema } from '@/shared/schemas/alert-rule'
import { parseChannelIdsColumn } from './queries'

interface MissedCandidate {
  job: typeof jobs.$inferSelect
  ruleId: string
  ruleName: string
  channelIds: string[]
  silenceThresholdMinutes: number
}

type MissedMessage = Extract<AlertQueueMessage, { ruleKind: 'missed_schedule' }>

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
  try {
    const config = AlertRuleConfigSchema.parse({
      kind: row.rule.kind,
      ...JSON.parse(row.rule.config),
    })
    if (config.kind !== 'missed_schedule') return null
    const channelIds = parseChannelIdsColumn(row.rule.channelIds)
    if (channelIds.length === 0) return null
    return {
      job: row.job,
      ruleId: row.rule.id,
      ruleName: row.rule.name,
      channelIds,
      silenceThresholdMinutes: config.silence_threshold_minutes,
    }
  } catch (err) {
    logError('alert.missed_schedule_rule_parse_failed', err, { ruleId: row.rule.id })
    return null
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

function buildMessages(
  candidates: readonly MissedCandidate[],
  lastRunAtByJob: ReadonlyMap<string, Date | null>,
): MissedMessage[] {
  return candidates.flatMap((candidate) => {
    const lastRunAt = lastRunAtByJob.get(candidate.job.id) ?? null
    return candidate.channelIds.map((channelId) => ({
      jobId: candidate.job.id,
      ruleId: candidate.ruleId,
      channelId,
      ruleName: candidate.ruleName,
      ruleKind: 'missed_schedule',
      lastRunAt: lastRunAt?.toISOString() ?? null,
      silenceThresholdMinutes: candidate.silenceThresholdMinutes,
    }))
  })
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
  const messages = buildMessages(firing, lastRunAtByJob)
  if (messages.length === 0) {
    return {
      evaluatedJobs,
      firingRules: 0,
      enqueued: 0,
    }
  }

  await enqueueAlertBatch(alertQueue, messages)
  const firedJobIds = [...new Set(firing.map((candidate) => candidate.job.id))]
  await db
    .update(jobs)
    .set({ lastMissedAlertAt: tick, updatedAt: tick })
    .where(inArray(jobs.id, firedJobIds))

  const result = {
    evaluatedJobs,
    firingRules: firing.length,
    enqueued: messages.length,
  }
  logInfo('alert.missed_schedule_evaluated', result)
  return result
}
