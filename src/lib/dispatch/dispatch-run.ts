import { eq } from 'drizzle-orm'
import { enqueueAlertBatch } from '@/lib/alert-queue/producer'
import type { AlertQueueMessage } from '@/lib/alert-queue/types'
import { evaluateRulesForRun } from '@/lib/alert-rules/evaluator'
import type { Database } from '@/lib/db/client'
import { createDb } from '@/lib/db/client'
import { newId } from '@/lib/db/ids'
import { attempts, jobs, runs, targets, workspaces } from '@/lib/db/schema'
import { logError, logInfo, logWarn } from '@/lib/log'
import { redactHeaders } from '@/lib/runs/header-redaction'
import { buildAccessHeaders, TunnelCredentialError } from '@/lib/tunnels/access-headers'
import { fetchActiveSecretPlaintext } from '@/lib/workspace-secrets/commands'
import type { TriggerSource } from '@/shared/schemas/run'
import { mergeEffectiveVariables } from '@/shared/schemas/workspace-variables'
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
  ALERT_QUEUE?: Queue<AlertQueueMessage>
  BOOP_SECRETS_KEK?: SecretsStoreSecret
}

export interface DispatchDeps {
  db: Database
  bodies: R2Bucket
  sleep?: (ms: number) => Promise<void>
  preCreatedRunId?: string
  alertQueue?: Queue<AlertQueueMessage>
  kek?: string
  bodyReadTimeoutMs?: number
}

async function evaluateAndEnqueueAlerts(
  db: Database,
  alertQueue: Queue<AlertQueueMessage>,
  workspaceId: string,
  jobId: string,
  runId: string,
): Promise<void> {
  try {
    const firing = await evaluateRulesForRun({ db, workspaceId, jobId, runId })
    if (firing.length === 0) {
      logInfo('alert.evaluated', { jobId, runId, firingCount: 0 })
      return
    }
    const messages = firing.flatMap((pair) =>
      pair.channelIds.map((channelId) => ({
        runId,
        ruleId: pair.ruleId,
        channelId,
        ruleName: pair.ruleName,
        ruleKind: pair.ruleKind,
      })),
    )
    await enqueueAlertBatch(alertQueue, messages)
    logInfo('alert.evaluated', {
      jobId,
      runId,
      firingCount: firing.length,
      enqueueCount: messages.length,
    })
  } catch (err) {
    logError('alert.evaluation_failed', err, { jobId, runId })
  }
}

type Job = typeof jobs.$inferSelect
type Workspace = typeof workspaces.$inferSelect
type Target = typeof targets.$inferSelect
type FailureKind = NonNullable<(typeof attempts.$inferSelect)['failureKind']>
type Outcome = NonNullable<(typeof runs.$inferSelect)['outcome']>

const DEFAULT_ATTEMPT_TIMEOUT_MS = 30_000
const BACKOFF_BASE_MS = 30_000
const MAX_RESPONSE_BODY_BYTES = 1_048_576
const RESPONSE_BODY_READ_TIMEOUT_MS = 10_000

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
    .select({ job: jobs, workspace: workspaces, target: targets })
    .from(jobs)
    .innerJoin(workspaces, eq(workspaces.id, jobs.workspaceId))
    .innerJoin(targets, eq(targets.id, jobs.targetId))
    .where(eq(jobs.id, jobId))
    .limit(1)
  return row[0] ?? null
}

function effectiveTimezone(job: Job, workspace: Workspace) {
  return job.triggerTimezone ?? workspace.timezone
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

// Case-insensitive merge where override wins. HTTP header names are
// case-insensitive, so a template header must override an Access default even
// when their casing differs (otherwise fetch() comma-combines the duplicates).
function mergeHeaders(
  base: Record<string, string>,
  override: Record<string, string>,
): Record<string, string> {
  const overrideKeys = new Set(Object.keys(override).map((k) => k.toLowerCase()))
  const merged: Record<string, string> = {}
  for (const [key, value] of Object.entries(base)) {
    if (!overrideKeys.has(key.toLowerCase())) merged[key] = value
  }
  return { ...merged, ...override }
}

interface AttemptOutcome {
  httpStatus: number | null
  failureKind: FailureKind | null
  error: TargetTimeoutError | TargetNetworkError | TargetHttpError | null
  redactedHeaders: Record<string, string>
}

function abortableRead(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  signal: AbortSignal,
): Promise<ReadableStreamReadResult<Uint8Array>> {
  if (signal.aborted) return Promise.reject(signal.reason)
  return new Promise((resolve, reject) => {
    const onAbort = () => reject(signal.reason)
    signal.addEventListener('abort', onAbort, { once: true })
    reader.read().then(
      (result) => {
        signal.removeEventListener('abort', onAbort)
        resolve(result)
      },
      (err) => {
        signal.removeEventListener('abort', onAbort)
        reject(err)
      },
    )
  })
}

// Read into memory bounded by size and time so a target that streams without a
// Content-Length (or never closes) can't stall the dispatch.
async function readCappedBody(
  body: ReadableStream<Uint8Array> | null,
  timeoutMs: number,
): Promise<Uint8Array> {
  if (!body) return new Uint8Array()
  const reader = body.getReader()
  const signal = AbortSignal.timeout(timeoutMs)
  const chunks: Uint8Array[] = []
  let total = 0
  try {
    while (total < MAX_RESPONSE_BODY_BYTES) {
      const { done, value } = await abortableRead(reader, signal)
      if (done) break
      if (value?.byteLength) {
        chunks.push(value)
        total += value.byteLength
      }
    }
  } catch {
    // Timed out, aborted, or stream error: persist whatever arrived.
  } finally {
    reader.cancel().catch(() => {})
  }
  const size = Math.min(total, MAX_RESPONSE_BODY_BYTES)
  const out = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    if (offset >= size) break
    const slice = chunk.subarray(0, size - offset)
    out.set(slice, offset)
    offset += slice.byteLength
  }
  return out
}

async function persistResponseBody(
  bodies: R2Bucket,
  key: string,
  body: ReadableStream<Uint8Array> | null,
  timeoutMs: number,
): Promise<void> {
  try {
    await bodies.put(key, await readCappedBody(body, timeoutMs))
  } catch (err) {
    logError('dispatch.response_persist_failed', err, { key })
  }
}

async function performAttempt(
  bodies: R2Bucket,
  target: Target,
  renderedBody: string,
  renderedHeaders: string,
  responseKey: string,
  bodyReadTimeoutMs: number,
  accessHeaders: Record<string, string>,
): Promise<AttemptOutcome> {
  const hasBody = target.method !== 'GET' && target.method !== 'HEAD'
  // Access headers are the base; template-rendered headers win on key conflict.
  const rawHeaders = mergeHeaders(accessHeaders, parseHeaders(renderedHeaders))
  const redactedHeaders = redactHeaders(rawHeaders)
  try {
    const response = await fetch(target.url, {
      method: target.method,
      headers: rawHeaders,
      ...(hasBody && { body: renderedBody }),
      signal: AbortSignal.timeout(DEFAULT_ATTEMPT_TIMEOUT_MS),
    })
    // Outcome is the HTTP status; body persistence is best-effort (a Content-Length-less body must not become a timeout).
    await persistResponseBody(bodies, responseKey, response.body, bodyReadTimeoutMs)
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

async function cancelPreCreatedRun(db: Database, runId: string, reason: string): Promise<void> {
  const now = new Date()
  await db
    .update(runs)
    .set({ status: 'canceled', skippedReason: reason, completedAt: now, updatedAt: now })
    .where(eq(runs.id, runId))
}

export async function runDispatch(
  {
    db,
    bodies,
    sleep = defaultSleep,
    preCreatedRunId,
    alertQueue,
    kek,
    bodyReadTimeoutMs = RESPONSE_BODY_READ_TIMEOUT_MS,
  }: DispatchDeps,
  jobId: string,
  scheduledAt: Date,
  triggerSource: TriggerSource = 'cron',
): Promise<void> {
  const claimed = await claimJob(db, jobId)
  if (claimed === null) {
    if (preCreatedRunId) await cancelPreCreatedRun(db, preCreatedRunId, 'claim_failed')
    throw new ClaimFailedError(jobId)
  }
  try {
    const joined = await readJoined(db, jobId)
    if (!joined) {
      if (preCreatedRunId) await cancelPreCreatedRun(db, preCreatedRunId, 'not_found')
      throw new JobNotDispatchableError(jobId, 'not_found')
    }
    const { job, workspace, target } = joined
    if (workspace.status === 'archived') {
      if (preCreatedRunId) await cancelPreCreatedRun(db, preCreatedRunId, 'workspace_archived')
      throw new JobNotDispatchableError(jobId, 'workspace_archived')
    }
    if (job.status === 'paused' || job.status === 'archived') {
      if (preCreatedRunId) await cancelPreCreatedRun(db, preCreatedRunId, `job_${job.status}`)
      throw new JobNotDispatchableError(jobId, job.status)
    }
    if (target.status === 'archived') {
      if (preCreatedRunId) await cancelPreCreatedRun(db, preCreatedRunId, 'target_archived')
      throw new JobNotDispatchableError(jobId, 'target_archived')
    }

    const runId = preCreatedRunId ?? newId('run')
    const startedAt = new Date()
    const deadlineAt = startedAt.getTime() + job.overallDeadlineMs
    if (preCreatedRunId) {
      await db
        .update(runs)
        .set({ status: 'running', startedAt, updatedAt: startedAt })
        .where(eq(runs.id, runId))
    } else {
      await db.insert(runs).values({
        id: runId,
        jobId: job.id,
        workspaceId: workspace.id,
        scheduledAt,
        startedAt,
        status: 'running',
        triggerSource,
      })
    }

    let renderedBody: string
    let renderedHeaders: string
    try {
      const renderCtx = {
        runId,
        attemptNumber: 1,
        workspaceName: workspace.name,
        workspaceTimezone: effectiveTimezone(job, workspace),
        now: startedAt,
        variables: mergeEffectiveVariables(workspace.variables, job.variables),
        ...(kek
          ? {
              secretResolver: (name: string) =>
                fetchActiveSecretPlaintext({ db, kek }, workspace.id, name),
            }
          : {}),
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

    let accessHeaders: Record<string, string>
    try {
      accessHeaders = await buildAccessHeaders({ db, kek: kek ?? '' }, target)
    } catch (err) {
      if (!(err instanceof TunnelCredentialError)) throw err
      const failedAt = new Date()
      await db.insert(attempts).values({
        id: newId('att'),
        runId,
        attemptNumber: 1,
        startedAt: failedAt,
        completedAt: failedAt,
        failureKind: 'tunnel_credential_missing',
      })
      await db
        .update(runs)
        .set({
          status: 'completed',
          outcome: 'failure',
          completedAt: failedAt,
          updatedAt: failedAt,
        })
        .where(eq(runs.id, runId))
      logWarn('dispatch.tunnel_credential_missing', { jobId, runId, targetId: target.id })
      if (alertQueue) {
        await evaluateAndEnqueueAlerts(db, alertQueue, workspace.id, job.id, runId)
      }
      return
    }

    let lastError: TargetTimeoutError | TargetNetworkError | TargetHttpError | null = null
    let lastHttpStatus: number | null = null
    let lastFailureKind: FailureKind | null = null
    let timedOutByDeadline = false

    for (let attemptIndex = 0; attemptIndex < job.maxAttempts; attemptIndex++) {
      const attemptNumber = attemptIndex + 1
      const attemptId = newId('att')
      const attemptStartedAt = new Date()
      const requestKey = r2KeyFor(workspace.id, runId, attemptNumber, 'request')
      const responseKey = r2KeyFor(workspace.id, runId, attemptNumber, 'response')

      await Promise.all([
        db.insert(attempts).values({
          id: attemptId,
          runId,
          attemptNumber,
          startedAt: attemptStartedAt,
          requestBodyR2Key: requestKey,
        }),
        bodies.put(requestKey, renderedBody),
      ])

      const result = await performAttempt(
        bodies,
        target,
        renderedBody,
        renderedHeaders,
        responseKey,
        bodyReadTimeoutMs,
        accessHeaders,
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

    if (alertQueue) {
      await evaluateAndEnqueueAlerts(db, alertQueue, workspace.id, job.id, runId)
    }

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
  // KEK is optional; without it workspace-secret substitution is skipped.
  let kek: string | undefined
  try {
    kek = await env.BOOP_SECRETS_KEK?.get()
  } catch {
    kek = undefined
  }
  return runDispatch(
    {
      db: createDb(env.DB),
      bodies: env.BODIES,
      ...(env.ALERT_QUEUE ? { alertQueue: env.ALERT_QUEUE } : {}),
      ...(kek ? { kek } : {}),
    },
    jobId,
    scheduledAt,
    triggerSource,
  )
}
