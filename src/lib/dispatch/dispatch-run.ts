import { eq } from 'drizzle-orm'
import type { Database } from '@/lib/db/client'
import { createDb } from '@/lib/db/client'
import { newId } from '@/lib/db/ids'
import { attempts, customers, jobs, runs, targets } from '@/lib/db/schema'
import { logError, logInfo } from '@/lib/log'
import { claimJob, releaseJob } from './claim'
import { ClaimFailedError, JobNotDispatchableError } from './errors'
import { r2KeyFor } from './r2-keys'
import { renderTemplate } from './render'

export interface DispatchEnv {
  DB: D1Database
  BODIES: R2Bucket
}

export interface DispatchDeps {
  db: Database
  bodies: R2Bucket
}

type Job = typeof jobs.$inferSelect
type Customer = typeof customers.$inferSelect
type FailureKind = NonNullable<(typeof attempts.$inferSelect)['failureKind']>
type Outcome = NonNullable<(typeof runs.$inferSelect)['outcome']>

const DEFAULT_TIMEOUT_MS = 30_000

async function readJoined(db: Database, jobId: string) {
  const row = await db
    .select({ job: jobs, customer: customers, target: targets })
    .from(jobs)
    .innerJoin(customers, eq(customers.id, jobs.customerId))
    .innerJoin(targets, eq(targets.id, jobs.targetId))
    .where(eq(jobs.id, jobId))
    .limit(1)
  return row[0] ?? null
}

function effectiveTimezone(job: Job, customer: Customer) {
  return job.triggerTimezone ?? customer.timezone
}

function parseHeaders(rendered: string): HeadersInit {
  if (!rendered.trim()) return {}
  try {
    return JSON.parse(rendered) as HeadersInit
  } catch {
    return {}
  }
}

function classifyHttpFailure(status: number): FailureKind {
  if (status >= 400 && status < 500) return 'http_4xx'
  if (status >= 500 && status < 600) return 'http_5xx'
  return 'non_2xx_other'
}

export async function runDispatch(
  { db, bodies }: DispatchDeps,
  jobId: string,
  scheduledAt: Date,
): Promise<void> {
  const claimed = await claimJob(db, jobId)
  if (claimed === null) {
    throw new ClaimFailedError(jobId)
  }
  try {
    const joined = await readJoined(db, jobId)
    if (!joined) {
      throw new JobNotDispatchableError(jobId, 'not_found')
    }
    const { job, customer, target } = joined
    if (customer.status === 'archived') {
      throw new JobNotDispatchableError(jobId, 'customer_archived')
    }
    if (job.status === 'paused' || job.status === 'archived') {
      throw new JobNotDispatchableError(jobId, job.status)
    }

    const runId = newId('run')
    const startedAt = new Date()
    await db.insert(runs).values({
      id: runId,
      jobId: job.id,
      customerId: customer.id,
      scheduledAt,
      startedAt,
      status: 'running',
    })

    const renderCtx = {
      runId,
      attemptNumber: 1,
      customerName: customer.name,
      customerTimezone: effectiveTimezone(job, customer),
      now: startedAt,
    }
    const [renderedBody, renderedHeaders] = await Promise.all([
      renderTemplate(job.bodyTemplate, renderCtx),
      renderTemplate(job.headersTemplate, renderCtx),
    ])

    const attemptId = newId('att')
    const attemptStartedAt = new Date()
    const requestR2Key = r2KeyFor(customer.id, runId, 1, 'request')
    const responseR2Key = r2KeyFor(customer.id, runId, 1, 'response')

    await db.insert(attempts).values({
      id: attemptId,
      runId,
      attemptNumber: 1,
      startedAt: attemptStartedAt,
      requestBodyR2Key: requestR2Key,
    })
    await bodies.put(requestR2Key, renderedBody)

    let httpStatus: number | null = null
    let failureKind: FailureKind | null = null

    const hasBody = target.method !== 'GET' && target.method !== 'HEAD'
    try {
      const response = await fetch(target.url, {
        method: target.method,
        headers: parseHeaders(renderedHeaders),
        ...(hasBody && { body: renderedBody }),
        signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
      })
      httpStatus = response.status
      await bodies.put(responseR2Key, response.body)
      if (!response.ok) failureKind = classifyHttpFailure(response.status)
    } catch (err) {
      failureKind =
        err instanceof DOMException && err.name === 'TimeoutError' ? 'timeout' : 'network'
      logError('dispatch.fetch_failed', err, { jobId, runId })
    }

    const attemptCompletedAt = new Date()
    await db
      .update(attempts)
      .set({
        completedAt: attemptCompletedAt,
        httpStatus,
        failureKind,
        responseBodyR2Key: httpStatus !== null ? responseR2Key : null,
        updatedAt: attemptCompletedAt,
      })
      .where(eq(attempts.id, attemptId))

    const outcome: Outcome =
      failureKind === null ? 'success' : failureKind === 'timeout' ? 'timeout' : 'failure'

    await db
      .update(runs)
      .set({
        status: 'completed',
        outcome,
        completedAt: attemptCompletedAt,
        updatedAt: attemptCompletedAt,
      })
      .where(eq(runs.id, runId))

    logInfo('dispatch.run_completed', { jobId, runId, outcome, httpStatus })
  } finally {
    await releaseJob(db, jobId)
  }
}

export async function dispatchRun(
  env: DispatchEnv,
  jobId: string,
  scheduledAt: Date,
): Promise<void> {
  return runDispatch({ db: createDb(env.DB), bodies: env.BODIES }, jobId, scheduledAt)
}
