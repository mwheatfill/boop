import { eq } from 'drizzle-orm'
import type { Database } from '@/lib/db/client'
import { createDb } from '@/lib/db/client'
import { newId } from '@/lib/db/ids'
import { attempts, customers, jobs, runs, targets } from '@/lib/db/schema'
import { logError, logInfo } from '@/lib/log'
import { redactHeaders } from '@/lib/runs/header-redaction'
import type { TriggerSource } from '@/shared/schemas/run'
import { claimJob, releaseJob } from './claim'
import {
  ClaimFailedError,
  isRetryableDispatchError,
  JobNotDispatchableError,
  RenderError,
  TargetHttpError,
  TargetNetworkError,
  TargetTimeoutError,
} from './errors'
import { r2KeyFor } from './r2-keys'
import { renderTemplate } from './render'

export interface DispatchEnv {
  DB: D1Database
  BODIES: R2Bucket
}

export interface DispatchDeps {
  db: Database
  bodies: R2Bucket
  sleep?: (ms: number) => Promise<void>
}

type Job = typeof jobs.$inferSelect
type Customer = typeof customers.$inferSelect
type Target = typeof targets.$inferSelect
type FailureKind = NonNullable<(typeof attempts.$inferSelect)['failureKind']>
type Outcome = NonNullable<(typeof runs.$inferSelect)['outcome']>

const DEFAULT_ATTEMPT_TIMEOUT_MS = 30_000
const BACKOFF_BASE_MS = 30_000

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

function backoffMs(attemptIndex: number): number {
  return 2 ** attemptIndex * BACKOFF_BASE_MS
}

function classifyHttpFailure(status: number): FailureKind {
  if (status >= 400 && status < 500) return 'http_4xx'
  if (status >= 500 && status < 600) return 'http_5xx'
  return 'non_2xx_other'
}

function outcomeFor(lastError: unknown): Outcome {
  if (lastError === null) return 'success'
  if (lastError instanceof TargetTimeoutError) return 'timeout'
  return 'failure'
}

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

function parseHeaders(rendered: string): Record<string, string> {
  if (!rendered.trim()) return {}
  try {
    const parsed = JSON.parse(rendered)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, string>
    }
    return {}
  } catch {
    return {}
  }
}

interface AttemptOutcome {
  httpStatus: number | null
  failureKind: FailureKind | null
  error: TargetTimeoutError | TargetNetworkError | TargetHttpError | null
  redactedHeaders: Record<string, string>
}

async function performAttempt(
  bodies: R2Bucket,
  target: Target,
  renderedBody: string,
  renderedHeaders: string,
  responseKey: string,
): Promise<AttemptOutcome> {
  const hasBody = target.method !== 'GET' && target.method !== 'HEAD'
  const rawHeaders = parseHeaders(renderedHeaders)
  const redactedHeaders = redactHeaders(rawHeaders)
  try {
    const response = await fetch(target.url, {
      method: target.method,
      headers: rawHeaders,
      ...(hasBody && { body: renderedBody }),
      signal: AbortSignal.timeout(DEFAULT_ATTEMPT_TIMEOUT_MS),
    })
    await bodies.put(responseKey, response.body)
    if (response.ok) {
      return { httpStatus: response.status, failureKind: null, error: null, redactedHeaders }
    }
    const httpErr = new TargetHttpError(response.status)
    return {
      httpStatus: response.status,
      failureKind: classifyHttpFailure(response.status),
      error: httpErr,
      redactedHeaders,
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === 'TimeoutError') {
      return {
        httpStatus: null,
        failureKind: 'timeout',
        error: new TargetTimeoutError(),
        redactedHeaders,
      }
    }
    return {
      httpStatus: null,
      failureKind: 'network',
      error: new TargetNetworkError(err),
      redactedHeaders,
    }
  }
}

export async function runDispatch(
  { db, bodies, sleep = defaultSleep }: DispatchDeps,
  jobId: string,
  scheduledAt: Date,
  triggerSource: TriggerSource = 'cron',
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
    const deadlineAt = startedAt.getTime() + job.overallDeadlineMs
    await db.insert(runs).values({
      id: runId,
      jobId: job.id,
      customerId: customer.id,
      scheduledAt,
      startedAt,
      status: 'running',
      triggerSource,
    })

    let renderedBody: string
    let renderedHeaders: string
    try {
      const renderCtx = {
        runId,
        attemptNumber: 1,
        customerName: customer.name,
        customerTimezone: effectiveTimezone(job, customer),
        now: startedAt,
      }
      ;[renderedBody, renderedHeaders] = await Promise.all([
        renderTemplate(job.bodyTemplate, renderCtx),
        renderTemplate(job.headersTemplate, renderCtx),
      ])
    } catch (err) {
      const now = new Date()
      await db
        .update(runs)
        .set({ status: 'completed', outcome: 'failure', completedAt: now, updatedAt: now })
        .where(eq(runs.id, runId))
      throw new RenderError(err)
    }

    let lastError: TargetTimeoutError | TargetNetworkError | TargetHttpError | null = null
    let lastHttpStatus: number | null = null
    let lastFailureKind: FailureKind | null = null
    let timedOutByDeadline = false

    for (let attemptIndex = 0; attemptIndex < job.maxAttempts; attemptIndex++) {
      const attemptNumber = attemptIndex + 1
      const attemptId = newId('att')
      const attemptStartedAt = new Date()
      const requestKey = r2KeyFor(customer.id, runId, attemptNumber, 'request')
      const responseKey = r2KeyFor(customer.id, runId, attemptNumber, 'response')

      await db.insert(attempts).values({
        id: attemptId,
        runId,
        attemptNumber,
        startedAt: attemptStartedAt,
        requestBodyR2Key: requestKey,
      })
      await bodies.put(requestKey, renderedBody)

      const result = await performAttempt(
        bodies,
        target,
        renderedBody,
        renderedHeaders,
        responseKey,
      )
      const attemptCompletedAt = new Date()
      await db
        .update(attempts)
        .set({
          completedAt: attemptCompletedAt,
          httpStatus: result.httpStatus,
          failureKind: result.failureKind,
          responseBodyR2Key: result.httpStatus !== null ? responseKey : null,
          requestHeadersJson: JSON.stringify(result.redactedHeaders),
          updatedAt: attemptCompletedAt,
        })
        .where(eq(attempts.id, attemptId))

      if (result.error === null) {
        lastError = null
        lastHttpStatus = result.httpStatus
        lastFailureKind = null
        break
      }

      lastError = result.error
      lastHttpStatus = result.httpStatus
      lastFailureKind = result.failureKind

      if (!isRetryableDispatchError(result.error)) break
      if (attemptIndex + 1 >= job.maxAttempts) break

      const delay = backoffMs(attemptIndex)
      if (Date.now() + delay >= deadlineAt) {
        timedOutByDeadline = true
        break
      }
      logError('dispatch.attempt_retrying', result.error, { jobId, runId, attemptNumber, delay })
      await sleep(delay)
      if (Date.now() >= deadlineAt) {
        timedOutByDeadline = true
        break
      }
    }

    const completedAt = new Date()
    if (timedOutByDeadline && lastError !== null) {
      const timeoutErr = new TargetTimeoutError()
      const [latestAttempt] = await db
        .select({ id: attempts.id })
        .from(attempts)
        .where(eq(attempts.runId, runId))
        .orderBy(attempts.attemptNumber)
      if (latestAttempt) {
        await db
          .update(attempts)
          .set({ failureKind: 'timeout', updatedAt: completedAt })
          .where(eq(attempts.id, latestAttempt.id))
      }
      lastError = timeoutErr
      lastFailureKind = 'timeout'
    }

    const outcome = outcomeFor(lastError)
    await db
      .update(runs)
      .set({ status: 'completed', outcome, completedAt, updatedAt: completedAt })
      .where(eq(runs.id, runId))

    logInfo('dispatch.run_completed', {
      jobId,
      runId,
      outcome,
      lastHttpStatus,
      lastFailureKind,
    })

    if (lastError !== null && isRetryableDispatchError(lastError)) {
      throw lastError
    }
  } finally {
    await releaseJob(db, jobId)
  }
}

export async function dispatchRun(
  env: DispatchEnv,
  jobId: string,
  scheduledAt: Date,
  triggerSource: TriggerSource = 'cron',
): Promise<void> {
  return runDispatch(
    { db: createDb(env.DB), bodies: env.BODIES },
    jobId,
    scheduledAt,
    triggerSource,
  )
}
