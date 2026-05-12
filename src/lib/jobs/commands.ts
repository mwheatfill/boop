import { and, eq } from 'drizzle-orm'
import type { Database } from '@/lib/db/client'
import { newId } from '@/lib/db/ids'
import { customers, jobs, targets } from '@/lib/db/schema'
import type { DispatchMessage } from '@/lib/dispatch/scheduled'
import { FieldValidationError, isUniqueConstraintViolation, NotFoundError } from '@/lib/errors'
import { slugify } from '@/lib/slug/slugify'
import type { Job, JobCreateInput, JobUpdateInput, TriggerKind } from '@/shared/schemas/job'
import { getJobDetail } from './queries'
import { planTriggerTransition, type TriggerColumn } from './trigger-transition'

export interface JobsDeps {
  db: Database
  dispatchQueue: Queue<DispatchMessage>
  enterIntervalMode: (jobId: string) => Promise<void>
  enterCronMode: (jobId: string) => Promise<void>
  enterWebhookMode: (jobId: string) => Promise<void>
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

function normalizeSlug(raw: string): string {
  const slug = slugify(raw)
  if (slug.length === 0) {
    throw new FieldValidationError({ slug: ['Slug must contain letters or digits'] })
  }
  return slug
}

async function resolveCustomerId(db: Database, customerSlug: string): Promise<string> {
  const row = (
    await db.select().from(customers).where(eq(customers.slug, customerSlug)).limit(1)
  )[0]
  if (!row) throw new NotFoundError('Customer', customerSlug)
  return row.id
}

async function resolveTargetId(
  db: Database,
  customerId: string,
  targetSlug: string,
): Promise<string> {
  const row = (
    await db
      .select()
      .from(targets)
      .where(and(eq(targets.customerId, customerId), eq(targets.slug, targetSlug)))
      .limit(1)
  )[0]
  if (!row) {
    throw new FieldValidationError({
      targetSlug: [`No active Target with slug '${targetSlug}' for this Customer`],
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
  customerSlug: string,
  input: JobCreateInput,
): Promise<Job> {
  const customerId = await resolveCustomerId(deps.db, customerSlug)
  const targetId = await resolveTargetId(deps.db, customerId, input.targetSlug)
  const slug = normalizeSlug(input.slug)
  const id = newId('job')
  const trig = triggerColumnsFor(input)
  try {
    await deps.db.insert(jobs).values({
      id,
      customerId,
      targetId,
      name: input.name.trim(),
      slug,
      triggerKind: input.trigger.triggerKind,
      cronExpression: trig.cronExpression,
      intervalSeconds: trig.intervalSeconds,
      triggerTimezone: trig.triggerTimezone,
      bodyTemplate: input.bodyTemplate,
      headersTemplate: input.headersTemplate,
      maxAttempts: input.maxAttempts,
      overallDeadlineMs: input.overallDeadlineMs,
    })
  } catch (err) {
    if (isUniqueConstraintViolation(err, 'jobs.slug')) {
      throw new FieldValidationError({
        slug: [`Slug '${slug}' is already in use by another Job for this Customer`],
      })
    }
    throw err
  }
  if (input.trigger.triggerKind === 'interval') {
    await deps.enterIntervalMode(id)
  }
  return getJobDetail(deps.db, customerSlug, slug)
}

export async function updateJob(
  deps: JobsDeps,
  customerSlug: string,
  jobSlug: string,
  input: JobUpdateInput,
): Promise<Job> {
  const current = await getJobDetail(deps.db, customerSlug, jobSlug)
  const newTrig = triggerColumnsFor(input)
  const targetId = await resolveTargetId(deps.db, current.customerId, input.targetSlug)
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
      maxAttempts: input.maxAttempts,
      overallDeadlineMs: input.overallDeadlineMs,
      updatedAt: deps.now?.() ?? new Date(),
      ...nulled,
    })
    .where(eq(jobs.id, current.id))
  await performModeChange(deps, current.id, plan.modeChange)
  return getJobDetail(deps.db, customerSlug, jobSlug)
}

async function setJobStatus(
  db: Database,
  customerSlug: string,
  jobSlug: string,
  status: 'active' | 'paused' | 'archived',
  now: Date,
): Promise<Job> {
  const job = await getJobDetail(db, customerSlug, jobSlug)
  await db.update(jobs).set({ status, updatedAt: now }).where(eq(jobs.id, job.id))
  return getJobDetail(db, customerSlug, jobSlug)
}

export async function pauseJob(deps: JobsDeps, customerSlug: string, jobSlug: string) {
  return setJobStatus(deps.db, customerSlug, jobSlug, 'paused', deps.now?.() ?? new Date())
}

export async function resumeJob(deps: JobsDeps, customerSlug: string, jobSlug: string) {
  return setJobStatus(deps.db, customerSlug, jobSlug, 'active', deps.now?.() ?? new Date())
}

export async function archiveJob(deps: JobsDeps, customerSlug: string, jobSlug: string) {
  return setJobStatus(deps.db, customerSlug, jobSlug, 'archived', deps.now?.() ?? new Date())
}

export async function restoreJob(deps: JobsDeps, customerSlug: string, jobSlug: string) {
  const job = await setJobStatus(
    deps.db,
    customerSlug,
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
  customerSlug: string,
  jobSlug: string,
): Promise<Job> {
  const job = await getJobDetail(deps.db, customerSlug, jobSlug)
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
