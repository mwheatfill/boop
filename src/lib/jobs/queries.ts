import { and, desc, eq, inArray, type SQL, sql } from 'drizzle-orm'
import type { Database } from '@/lib/db/client'
import { customers, jobs, runs, targets } from '@/lib/db/schema'
import { NotFoundError } from '@/lib/errors'
import type { Job, JobSummary, TriggerKind } from '@/shared/schemas/job'

interface ListFilters {
  customerId?: string
  status?: 'active' | 'paused' | 'archived'
  includeArchived?: boolean
}

type JobRow = typeof jobs.$inferSelect

interface JoinedJobRow extends JobRow {
  customer: typeof customers.$inferSelect
  target: typeof targets.$inferSelect
}

function effectiveTz(job: { triggerTimezone: string | null }, customerTimezone: string): string {
  return job.triggerTimezone ?? customerTimezone
}

function toJobSummary(row: JoinedJobRow, lastRun?: typeof runs.$inferSelect): JobSummary {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    customerSlug: row.customer.slug,
    customerName: row.customer.name,
    triggerKind: row.triggerKind as TriggerKind,
    cronExpression: row.cronExpression,
    intervalSeconds: row.intervalSeconds,
    triggerTimezone: row.triggerTimezone,
    customerTimezone: row.customer.timezone,
    nextFireAt: row.nextFireAt?.toISOString() ?? null,
    lastFireAt: row.lastFireAt?.toISOString() ?? null,
    status: row.status as JobSummary['status'],
    lastRunOutcome: (lastRun?.outcome as JobSummary['lastRunOutcome']) ?? null,
    lastRunStartedAt: lastRun?.startedAt?.toISOString() ?? null,
  }
}

function toJob(row: JoinedJobRow): Job {
  return {
    id: row.id,
    customerId: row.customerId,
    customerSlug: row.customer.slug,
    customerName: row.customer.name,
    customerTimezone: row.customer.timezone,
    targetId: row.targetId,
    targetSlug: row.target.slug,
    targetName: row.target.name,
    name: row.name,
    slug: row.slug,
    triggerKind: row.triggerKind as TriggerKind,
    cronExpression: row.cronExpression,
    intervalSeconds: row.intervalSeconds,
    triggerTimezone: row.triggerTimezone,
    bodyTemplate: row.bodyTemplate,
    headersTemplate: row.headersTemplate,
    variables: row.variables,
    maxAttempts: row.maxAttempts,
    overallDeadlineMs: row.overallDeadlineMs,
    lastFireAt: row.lastFireAt?.toISOString() ?? null,
    nextFireAt: row.nextFireAt?.toISOString() ?? null,
    status: row.status as Job['status'],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

async function loadLatestRunsByJobId(
  db: Database,
  jobIds: string[],
): Promise<Map<string, typeof runs.$inferSelect>> {
  if (jobIds.length === 0) return new Map()
  const allRuns = await db
    .select()
    .from(runs)
    .where(inArray(runs.jobId, jobIds))
    .orderBy(desc(runs.startedAt))
  const map = new Map<string, typeof runs.$inferSelect>()
  for (const run of allRuns) {
    if (!map.has(run.jobId)) map.set(run.jobId, run)
  }
  return map
}

async function selectJoinedJobs(db: Database, where: SQL | undefined): Promise<JoinedJobRow[]> {
  const base = db
    .select({ job: jobs, customer: customers, target: targets })
    .from(jobs)
    .innerJoin(customers, eq(customers.id, jobs.customerId))
    .innerJoin(targets, eq(targets.id, jobs.targetId))
  const rows = where ? await base.where(where).orderBy(jobs.name) : await base.orderBy(jobs.name)
  return rows.map((r) => ({ ...r.job, customer: r.customer, target: r.target }))
}

export async function listAllJobs(db: Database, filters: ListFilters = {}): Promise<JobSummary[]> {
  const conditions: SQL[] = []
  if (filters.customerId) conditions.push(eq(jobs.customerId, filters.customerId))
  if (filters.status) conditions.push(eq(jobs.status, filters.status))
  else if (!filters.includeArchived) conditions.push(sql`${jobs.status} != 'archived'`)
  const joined = await selectJoinedJobs(db, conditions.length > 0 ? and(...conditions) : undefined)
  const latest = await loadLatestRunsByJobId(
    db,
    joined.map((j) => j.id),
  )
  return joined.map((j) => toJobSummary(j, latest.get(j.id)))
}

export async function listJobsForCustomer(
  db: Database,
  customerSlug: string,
  { includeArchived = false }: { includeArchived?: boolean } = {},
): Promise<JobSummary[]> {
  const customer = (
    await db.select().from(customers).where(eq(customers.slug, customerSlug)).limit(1)
  )[0]
  if (!customer) throw new NotFoundError('Customer', customerSlug)
  return listAllJobs(db, { customerId: customer.id, includeArchived })
}

export async function getJobDetail(
  db: Database,
  customerSlug: string,
  jobSlug: string,
): Promise<Job> {
  const customer = (
    await db.select().from(customers).where(eq(customers.slug, customerSlug)).limit(1)
  )[0]
  if (!customer) throw new NotFoundError('Customer', customerSlug)
  const joined = await selectJoinedJobs(
    db,
    and(eq(jobs.customerId, customer.id), eq(jobs.slug, jobSlug)),
  )
  const row = joined[0]
  if (!row) throw new NotFoundError('Job', `${customerSlug}/${jobSlug}`)
  return toJob(row)
}

export function effectiveTimezone(job: Pick<Job, 'triggerTimezone' | 'customerTimezone'>): string {
  return effectiveTz(job, job.customerTimezone)
}
