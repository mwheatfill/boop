import { Cron } from 'croner'
import type { InferInsertModel } from 'drizzle-orm'
import type { attempts, runs } from '@/lib/db/schema'
import { demoId } from './ids'
import type { DemoJobSpec, DistributionPattern } from './jobs'
import { createPrng, type Prng } from './prng'

export type RunInsert = InferInsertModel<typeof runs>
export type AttemptInsert = InferInsertModel<typeof attempts>

type ResolvedJob = {
  spec: DemoJobSpec
  jobId: string
  workspaceId: string
  workspaceSlug: string
  workspaceTimezone: string
}

const PAUSED_STOPPED_DAYS_AGO = 7

export function generateRunsForJob(
  job: ResolvedJob,
  windowStartAt: Date,
  windowEndAt: Date,
): { runs: RunInsert[]; attempts: AttemptInsert[] } {
  const rng = createPrng(`boop:demo:runs:${job.spec.workspaceSlug}:${job.spec.slug}`)
  const boundaries = boundariesForPattern(job.spec.pattern, windowEndAt, rng.fork('boundaries'))
  const fires = computeFireTimes(job, windowStartAt, windowEndAt)
  const runs: RunInsert[] = []
  const attempts: AttemptInsert[] = []

  let runOrdinal = 0
  for (const scheduledAt of fires) {
    const outcome = decideOutcome(job.spec.pattern, scheduledAt, boundaries, rng)
    if (!outcome) continue

    const triggerSource: RunInsert['triggerSource'] =
      job.spec.triggerKind === 'interval'
        ? 'interval'
        : job.spec.triggerKind === 'webhook'
          ? 'webhook'
          : 'cron'

    const startedAt = new Date(scheduledAt.getTime() + rng.int(50, 400))
    const attemptCount = outcome === 'success' ? (rng.bool(0.02) ? 2 : 1) : rng.int(1, 3)
    const runId = demoId('run', job.spec.workspaceSlug, job.spec.slug, String(runOrdinal++))

    let attemptStart = startedAt
    let lastAttemptEnd = attemptStart
    for (let n = 1; n <= attemptCount; n++) {
      const isLast = n === attemptCount
      const isSuccessAttempt = outcome === 'success' && isLast
      const latencyMs = computeLatency(job.spec, rng, isSuccessAttempt, outcome)
      const completedAt = new Date(attemptStart.getTime() + latencyMs)
      const httpStatus = pickHttpStatus(outcome, isLast, rng)
      const failureKind = pickFailureKind(httpStatus, outcome, isLast, rng)
      attempts.push({
        id: demoId('att', runId, String(n)),
        runId,
        attemptNumber: n,
        startedAt: attemptStart,
        completedAt,
        httpStatus,
        failureKind,
        requestBodyR2Key: null,
        responseBodyR2Key: null,
        requestHeadersJson: '{}',
        createdAt: attemptStart,
        updatedAt: completedAt,
      })
      lastAttemptEnd = completedAt
      if (!isLast) {
        attemptStart = new Date(completedAt.getTime() + rng.int(2000, 8000))
      }
    }

    runs.push({
      id: runId,
      jobId: job.jobId,
      workspaceId: job.workspaceId,
      scheduledAt,
      startedAt,
      completedAt: lastAttemptEnd,
      status: 'completed',
      outcome,
      triggerSource,
      skippedReason: null,
      createdAt: scheduledAt,
      updatedAt: lastAttemptEnd,
    })
  }

  return { runs, attempts }
}

type PatternBoundaries = {
  outage?: { start: Date; end: Date }
  failingSince?: Date
}

function boundariesForPattern(
  pattern: DistributionPattern,
  windowEndAt: Date,
  rng: Prng,
): PatternBoundaries {
  if (pattern === 'recent-outage') {
    const daysAgo = 1 + rng.int(0, 6)
    const durationH = 2 + rng.int(0, 4)
    const end = new Date(windowEndAt.getTime() - daysAgo * 86400_000)
    const start = new Date(end.getTime() - durationH * 3600_000)
    return { outage: { start, end } }
  }
  if (pattern === 'actively-failing') {
    const hoursAgo = 2 + rng.int(0, 10)
    const failingSince = new Date(windowEndAt.getTime() - hoursAgo * 3600_000)
    return { failingSince }
  }
  return {}
}

function computeFireTimes(job: ResolvedJob, windowStartAt: Date, windowEndAt: Date): Date[] {
  const fires: Date[] = []
  const effectiveEnd = job.spec.pattern === 'paused' ? pausedCutoff(windowEndAt) : windowEndAt

  if (job.spec.triggerKind === 'interval') {
    const stepMs = (job.spec.intervalSeconds ?? 60) * 1000
    for (let t = windowStartAt.getTime(); t <= effectiveEnd.getTime(); t += stepMs) {
      fires.push(new Date(t))
    }
    return fires
  }

  if (job.spec.triggerKind === 'webhook') {
    return scatterWebhookFires(job, windowStartAt, effectiveEnd)
  }

  if (!job.spec.cronExpression) return fires
  const timezone = job.spec.triggerTimezone ?? job.workspaceTimezone
  let cursor: Date | null = new Date(windowStartAt.getTime() - 1000)
  let cron: Cron
  try {
    cron = new Cron(job.spec.cronExpression, { timezone })
  } catch {
    return fires
  }
  while (cursor) {
    const next: Date | null = cron.nextRun(cursor)
    if (!next || next > effectiveEnd) break
    fires.push(next)
    cursor = next
  }
  return fires
}

function scatterWebhookFires(job: ResolvedJob, windowStartAt: Date, windowEndAt: Date): Date[] {
  const rng = createPrng(`boop:demo:webhookfires:${job.spec.workspaceSlug}:${job.spec.slug}`)
  const fires: Date[] = []
  const days = (windowEndAt.getTime() - windowStartAt.getTime()) / 86400_000
  const firesPerDay = 20 + rng.int(0, 30)
  const total = Math.floor(days * firesPerDay)
  for (let i = 0; i < total; i++) {
    const offset = rng.next() * (windowEndAt.getTime() - windowStartAt.getTime())
    fires.push(new Date(windowStartAt.getTime() + offset))
  }
  fires.sort((a, b) => a.getTime() - b.getTime())
  return fires
}

function pausedCutoff(windowEndAt: Date): Date {
  return new Date(windowEndAt.getTime() - PAUSED_STOPPED_DAYS_AGO * 86400_000)
}

function decideOutcome(
  pattern: DistributionPattern,
  scheduledAt: Date,
  boundaries: PatternBoundaries,
  rng: Prng,
): RunInsert['outcome'] | null {
  switch (pattern) {
    case 'steady-healthy':
      return rng.bool(0.992) ? 'success' : rng.bool(0.5) ? 'failure' : 'timeout'
    case 'high-variance':
      return rng.bool(0.98) ? 'success' : 'failure'
    case 'recent-outage': {
      const outage = boundaries.outage
      if (outage && scheduledAt >= outage.start && scheduledAt <= outage.end) {
        return rng.bool(0.85) ? 'failure' : 'timeout'
      }
      return rng.bool(0.995) ? 'success' : 'failure'
    }
    case 'actively-failing': {
      if (boundaries.failingSince && scheduledAt >= boundaries.failingSince) {
        return rng.bool(0.9) ? 'failure' : 'timeout'
      }
      return rng.bool(0.99) ? 'success' : 'failure'
    }
    case 'paused':
      return rng.bool(0.99) ? 'success' : 'failure'
  }
}

function computeLatency(
  spec: DemoJobSpec,
  rng: Prng,
  isSuccessAttempt: boolean,
  outcome: NonNullable<RunInsert['outcome']>,
): number {
  if (outcome === 'timeout' && !isSuccessAttempt) {
    return spec.overallDeadlineMs
  }
  const jitter = Math.floor(rng.next() * spec.latencyJitterMs)
  const spike = rng.bool(0.01) ? 4 + Math.floor(rng.next() * 3) : 1
  return Math.max(40, spec.latencyBaseMs + jitter) * spike
}

function pickHttpStatus(
  outcome: NonNullable<RunInsert['outcome']>,
  isLastAttempt: boolean,
  rng: Prng,
): number | null {
  if (outcome === 'success' && isLastAttempt) {
    return rng.bool(0.97) ? 200 : 201
  }
  if (outcome === 'timeout' && isLastAttempt) return null
  // failure or non-last attempt of any outcome
  const draw = rng.next()
  if (draw < 0.55) return 502
  if (draw < 0.75) return 503
  if (draw < 0.85) return 429
  if (draw < 0.93) return 422
  return null
}

function pickFailureKind(
  httpStatus: number | null,
  outcome: NonNullable<RunInsert['outcome']>,
  isLastAttempt: boolean,
  rng: Prng,
): AttemptInsert['failureKind'] {
  if (outcome === 'success' && isLastAttempt) return null
  if (outcome === 'timeout' && isLastAttempt) return 'timeout'
  if (httpStatus === null) return rng.bool(0.5) ? 'network' : 'timeout'
  if (httpStatus >= 500) return 'http_5xx'
  if (httpStatus >= 400) return 'http_4xx'
  return 'non_2xx_other'
}
