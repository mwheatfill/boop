import { and, desc, eq, inArray, type SQL, sql } from 'drizzle-orm'
import type { Database } from '@/lib/db/client'
import { jobs, runs, targets, workspaces } from '@/lib/db/schema'
import { NotFoundError } from '@/lib/errors'
import type { Job, JobSummary, TriggerKind } from '@/shared/schemas/job'
import type { TargetRef } from '@/shared/schemas/target'

interface ListFilters {
  workspaceId?: string
  status?: 'active' | 'paused' | 'archived'
  includeArchived?: boolean
}

type JobRow = typeof jobs.$inferSelect

interface JoinedJobRow extends JobRow {
  workspace: typeof workspaces.$inferSelect
  target: typeof targets.$inferSelect
}

function effectiveTz(job: { triggerTimezone: string | null }, workspaceTimezone: string): string {
  return job.triggerTimezone ?? workspaceTimezone
}

function targetRef(t: typeof targets.$inferSelect): TargetRef {
  return {
    slug: t.slug,
    name: t.name,
    method: t.method as TargetRef['method'],
    reachability: t.reachability as TargetRef['reachability'],
    url: t.url,
    internalOrigin: t.internalOrigin,
  }
}

function toJobSummary(row: JoinedJobRow, lastRun?: typeof runs.$inferSelect): JobSummary {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    target: targetRef(row.target),
    workspaceSlug: row.workspace.slug,
    workspaceName: row.workspace.name,
    triggerKind: row.triggerKind as TriggerKind,
    cronExpression: row.cronExpression,
    intervalSeconds: row.intervalSeconds,
    triggerTimezone: row.triggerTimezone,
    workspaceTimezone: row.workspace.timezone,
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
    workspaceId: row.workspaceId,
    workspaceSlug: row.workspace.slug,
    workspaceName: row.workspace.name,
    workspaceTimezone: row.workspace.timezone,
    targetId: row.targetId,
    targetSlug: row.target.slug,
    targetName: row.target.name,
    target: targetRef(row.target),
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
    .select({ job: jobs, workspace: workspaces, target: targets })
    .from(jobs)
    .innerJoin(workspaces, eq(workspaces.id, jobs.workspaceId))
    .innerJoin(targets, eq(targets.id, jobs.targetId))
  const rows = where ? await base.where(where).orderBy(jobs.name) : await base.orderBy(jobs.name)
  return rows.map((r) => ({ ...r.job, workspace: r.workspace, target: r.target }))
}

export async function listAllJobs(db: Database, filters: ListFilters = {}): Promise<JobSummary[]> {
  const conditions: SQL[] = []
  if (filters.workspaceId) conditions.push(eq(jobs.workspaceId, filters.workspaceId))
  if (filters.status) conditions.push(eq(jobs.status, filters.status))
  else if (!filters.includeArchived) conditions.push(sql`${jobs.status} != 'archived'`)
  const joined = await selectJoinedJobs(db, conditions.length > 0 ? and(...conditions) : undefined)
  const latest = await loadLatestRunsByJobId(
    db,
    joined.map((j) => j.id),
  )
  return joined.map((j) => toJobSummary(j, latest.get(j.id)))
}

export async function listJobsForWorkspace(
  db: Database,
  workspaceSlug: string,
  { includeArchived = false }: { includeArchived?: boolean } = {},
): Promise<JobSummary[]> {
  const workspace = (
    await db.select().from(workspaces).where(eq(workspaces.slug, workspaceSlug)).limit(1)
  )[0]
  if (!workspace) throw new NotFoundError('Workspace', workspaceSlug)
  return listAllJobs(db, { workspaceId: workspace.id, includeArchived })
}

export async function getJobDetail(
  db: Database,
  workspaceSlug: string,
  jobSlug: string,
): Promise<Job> {
  const workspace = (
    await db.select().from(workspaces).where(eq(workspaces.slug, workspaceSlug)).limit(1)
  )[0]
  if (!workspace) throw new NotFoundError('Workspace', workspaceSlug)
  const joined = await selectJoinedJobs(
    db,
    and(eq(jobs.workspaceId, workspace.id), eq(jobs.slug, jobSlug)),
  )
  const row = joined[0]
  if (!row) throw new NotFoundError('Job', `${workspaceSlug}/${jobSlug}`)
  return toJob(row)
}

export function effectiveTimezone(job: Pick<Job, 'triggerTimezone' | 'workspaceTimezone'>): string {
  return effectiveTz(job, job.workspaceTimezone)
}
