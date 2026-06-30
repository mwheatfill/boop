import { and, eq } from 'drizzle-orm'
import type { Database } from '@/lib/db/client'
import { newId } from '@/lib/db/ids'
import { jobs, targets } from '@/lib/db/schema'
import type { DispatchMessage } from '@/lib/dispatch/scheduled'
import { FieldValidationError, isUniqueConstraintViolation } from '@/lib/errors'
import { normalizeSlug, resolveWorkspaceId } from '@/lib/workspaces/resolve'
import type { Job, JobCreateInput, JobUpdateInput, TriggerKind } from '@/shared/schemas/job'
import { getJobDetail } from './queries'
import { planTriggerTransition, type TriggerColumn } from './trigger-transition'

export interface JobsDeps {
  db: Database
  dispatchQueue: Queue<DispatchMessage>
  enterIntervalMode: (jobId: string) => Promise<void>
  enterCronMode: (jobId: string) => Promise<void>
  enterWebhookMode: (jobId: string) => Promise<void>
  enterManualMode: (jobId: string) => Promise<void>
  now?: () => Date
}

interface TriggerColumns {
  cronExpression: string | null
  intervalSeconds: number | null
  triggerTimezone: string | null
}

function triggerColumnsFor(input: JobCreateInput | JobUpdateInput): TriggerColumns {
  if (input.trigger.triggerKind === 'cron') {
    return {
      cronExpression: input.trigger.cronExpression,
      intervalSeconds: null,
      triggerTimezone: input.trigger.triggerTimezone,
    }
  }
  if (input.trigger.triggerKind === 'interval') {
    return {
      cronExpression: null,
      intervalSeconds: input.trigger.intervalSeconds,
      triggerTimezone: null,
    }
  }
  return { cronExpression: null, intervalSeconds: null, triggerTimezone: null }
}

async function resolveTargetId(
  db: Database,
  workspaceId: string,
  targetSlug: string,
): Promise<string> {
  const row = (
    await db
      .select()
      .from(targets)
      .where(and(eq(targets.workspaceId, workspaceId), eq(targets.slug, targetSlug)))
      .limit(1)
  )[0]
  if (!row) {
    throw new FieldValidationError({
      targetSlug: [`No active Target with slug '${targetSlug}' for this Workspace`],
    })
  }
  return row.id
}

async function performModeChange(
  deps: JobsDeps,
  jobId: string,
  modeChange: TriggerKind | null,
): Promise<void> {
  if (modeChange === 'interval') await deps.enterIntervalMode(jobId)
  else if (modeChange === 'cron') await deps.enterCronMode(jobId)
  else if (modeChange === 'webhook') await deps.enterWebhookMode(jobId)
  else if (modeChange === 'manual') await deps.enterManualMode(jobId)
}

const columnFieldMap: Record<TriggerColumn, keyof TriggerColumns> = {
  cron_expression: 'cronExpression',
  interval_seconds: 'intervalSeconds',
  trigger_timezone: 'triggerTimezone',
}

function nulledTriggerColumns(columns: TriggerColumn[]): Partial<TriggerColumns> {
  const out: Partial<TriggerColumns> = {}
  for (const col of columns) out[columnFieldMap[col]] = null
  return out
}

export async function createJob(
  deps: JobsDeps,
  workspaceSlug: string,
  input: JobCreateInput,
): Promise<Job> {
  const workspaceId = await resolveWorkspaceId(deps.db, workspaceSlug)
  const targetId = await resolveTargetId(deps.db, workspaceId, input.targetSlug)
  const slug = normalizeSlug(input.slug)
  const id = newId('job')
  const trig = triggerColumnsFor(input)
  try {
    await deps.db.insert(jobs).values({
      id,
      workspaceId,
      targetId,
      name: input.name.trim(),
      slug,
      triggerKind: input.trigger.triggerKind,
      cronExpression: trig.cronExpression,
      intervalSeconds: trig.intervalSeconds,
      triggerTimezone: trig.triggerTimezone,
      bodyTemplate: input.bodyTemplate,
      headersTemplate: input.headersTemplate,
      variables: input.variables ?? {},
      maxAttempts: input.maxAttempts,
      overallDeadlineMs: input.overallDeadlineMs,
    })
  } catch (err) {
    if (isUniqueConstraintViolation(err, 'jobs.slug')) {
      throw new FieldValidationError({
        slug: [`Slug '${slug}' is already in use by another Job for this Workspace`],
      })
    }
    throw err
  }
  if (input.trigger.triggerKind === 'interval') {
    await deps.enterIntervalMode(id)
  }
  return getJobDetail(deps.db, workspaceSlug, slug)
}

export async function updateJob(
  deps: JobsDeps,
  workspaceSlug: string,
  jobSlug: string,
  input: JobUpdateInput,
): Promise<Job> {
  const current = await getJobDetail(deps.db, workspaceSlug, jobSlug)
  const newTrig = triggerColumnsFor(input)
  const targetId = await resolveTargetId(deps.db, current.workspaceId, input.targetSlug)
  const plan = planTriggerTransition({
    oldKind: current.triggerKind,
    newKind: input.trigger.triggerKind,
    oldIntervalSeconds: current.intervalSeconds,
    newIntervalSeconds: newTrig.intervalSeconds,
  })
  const nulled = nulledTriggerColumns(plan.columnsToNull)
  await deps.db
    .update(jobs)
    .set({
      targetId,
      name: input.name.trim(),
      triggerKind: input.trigger.triggerKind,
      cronExpression: newTrig.cronExpression,
      intervalSeconds: newTrig.intervalSeconds,
      triggerTimezone: newTrig.triggerTimezone,
      bodyTemplate: input.bodyTemplate,
      headersTemplate: input.headersTemplate,
      ...(input.variables !== undefined ? { variables: input.variables } : {}),
      maxAttempts: input.maxAttempts,
      overallDeadlineMs: input.overallDeadlineMs,
      updatedAt: deps.now?.() ?? new Date(),
      ...nulled,
    })
    .where(eq(jobs.id, current.id))
  await performModeChange(deps, current.id, plan.modeChange)
  return getJobDetail(deps.db, workspaceSlug, jobSlug)
}

async function setJobStatus(
  db: Database,
  workspaceSlug: string,
  jobSlug: string,
  status: 'active' | 'paused' | 'archived',
  now: Date,
): Promise<Job> {
  const job = await getJobDetail(db, workspaceSlug, jobSlug)
  await db.update(jobs).set({ status, updatedAt: now }).where(eq(jobs.id, job.id))
  return getJobDetail(db, workspaceSlug, jobSlug)
}

export async function pauseJob(deps: JobsDeps, workspaceSlug: string, jobSlug: string) {
  return setJobStatus(deps.db, workspaceSlug, jobSlug, 'paused', deps.now?.() ?? new Date())
}

export async function resumeJob(deps: JobsDeps, workspaceSlug: string, jobSlug: string) {
  return setJobStatus(deps.db, workspaceSlug, jobSlug, 'active', deps.now?.() ?? new Date())
}

export async function archiveJob(deps: JobsDeps, workspaceSlug: string, jobSlug: string) {
  return setJobStatus(deps.db, workspaceSlug, jobSlug, 'archived', deps.now?.() ?? new Date())
}

export async function restoreJob(deps: JobsDeps, workspaceSlug: string, jobSlug: string) {
  const job = await setJobStatus(
    deps.db,
    workspaceSlug,
    jobSlug,
    'active',
    deps.now?.() ?? new Date(),
  )
  if (job.triggerKind === 'interval') {
    await deps.enterIntervalMode(job.id)
  }
  return job
}

export async function runJobNow(
  deps: JobsDeps,
  workspaceSlug: string,
  jobSlug: string,
): Promise<Job> {
  const job = await getJobDetail(deps.db, workspaceSlug, jobSlug)
  if (job.status !== 'active') {
    throw new FieldValidationError({
      status: [`Job is ${job.status}; Run now is only available for active Jobs`],
    })
  }
  await deps.dispatchQueue.send({
    jobId: job.id,
    scheduledAt: deps.now?.() ?? new Date(),
    triggerSource: 'manual',
  })
  return job
}
