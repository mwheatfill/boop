import { and, asc, desc, eq, type SQL } from 'drizzle-orm'
import type { Database } from '@/lib/db/client'
import { attempts, jobs, runs, targets, workspaces } from '@/lib/db/schema'
import type {
  AttemptDetail,
  RunDetailResponse,
  RunSummaryRow,
  RunsListResponse,
  TriggerSource,
} from '@/shared/schemas/run'
import { buildWhere, encodeCursor, parseCursor } from './cursor-pagination'
import { computeDisplayOutcome } from './display-outcome'
import { filtersToWhere, type RunsFilters } from './filter-schema'

interface ListInput {
  filters: RunsFilters
  cursor?: string | undefined
  limit?: number
  now?: Date
}

interface ListForJobInput {
  jobId: string
  cursor?: string | undefined
  limit?: number
}

const DEFAULT_LIMIT = 25

function durationMs(startedAt: Date | null, completedAt: Date | null): number | null {
  if (!startedAt || !completedAt) return null
  return completedAt.getTime() - startedAt.getTime()
}

type RunRow = typeof runs.$inferSelect
type JobRow = typeof jobs.$inferSelect
type WorkspaceRow = typeof workspaces.$inferSelect

interface JoinedRow {
  run: RunRow
  job: JobRow
  workspace: WorkspaceRow
}

function toRunSummaryRow(row: JoinedRow): RunSummaryRow {
  const startedAt = row.run.startedAt
  const completedAt = row.run.completedAt
  const status = row.run.status as RunSummaryRow['status']
  const outcome = (row.run.outcome as RunSummaryRow['outcome']) ?? null
  return {
    id: row.run.id,
    jobId: row.run.jobId,
    jobSlug: row.job.slug,
    jobName: row.job.name,
    workspaceId: row.run.workspaceId,
    workspaceSlug: row.workspace.slug,
    workspaceName: row.workspace.name,
    startedAt: startedAt?.toISOString() ?? null,
    completedAt: completedAt?.toISOString() ?? null,
    durationMs: durationMs(startedAt, completedAt),
    status,
    outcome,
    triggerSource: row.run.triggerSource as TriggerSource,
    displayOutcome: computeDisplayOutcome({
      status,
      outcome,
      skippedReason: row.run.skippedReason,
    }),
  }
}

async function selectJoinedRuns(
  db: Database,
  where: SQL | undefined,
  limit: number,
): Promise<JoinedRow[]> {
  const base = db
    .select({ run: runs, job: jobs, workspace: workspaces })
    .from(runs)
    .innerJoin(jobs, eq(jobs.id, runs.jobId))
    .innerJoin(workspaces, eq(workspaces.id, runs.workspaceId))
  const ordered = where
    ? base.where(where).orderBy(desc(runs.startedAt), desc(runs.id))
    : base.orderBy(desc(runs.startedAt), desc(runs.id))
  return await ordered.limit(limit)
}

function paginate<T extends { id: string; startedAt: string | null }>(
  rows: T[],
  limit: number,
): { rows: T[]; nextCursor: string | null } {
  if (rows.length <= limit) return { rows, nextCursor: null }
  const page = rows.slice(0, limit)
  const last = page[page.length - 1]
  if (!last?.startedAt) return { rows: page, nextCursor: null }
  return {
    rows: page,
    nextCursor: encodeCursor({ startedAt: new Date(last.startedAt), id: last.id }),
  }
}

export async function listAllRuns(
  db: Database,
  { filters, cursor, limit = DEFAULT_LIMIT, now }: ListInput,
): Promise<RunsListResponse> {
  const parsedCursor = parseCursor(cursor)
  const filterWhere = filtersToWhere(filters, now)
  const where = buildWhere(parsedCursor, filterWhere)
  const joined = await selectJoinedRuns(db, where, limit + 1)
  const summaryRows = joined.map(toRunSummaryRow)
  return paginate(summaryRows, limit)
}

export async function listRunsForJob(
  db: Database,
  { jobId, cursor, limit = DEFAULT_LIMIT }: ListForJobInput,
): Promise<RunsListResponse> {
  const parsedCursor = parseCursor(cursor)
  const where = buildWhere(parsedCursor, eq(runs.jobId, jobId))
  const joined = await selectJoinedRuns(db, where, limit + 1)
  const summaryRows = joined.map(toRunSummaryRow)
  return paginate(summaryRows, limit)
}

function toAttemptDetail(row: typeof attempts.$inferSelect): AttemptDetail {
  let requestHeaders: Record<string, string> | null = null
  if (row.requestHeadersJson) {
    try {
      const parsed = JSON.parse(row.requestHeadersJson)
      if (parsed && typeof parsed === 'object') {
        requestHeaders = parsed as Record<string, string>
      }
    } catch {
      requestHeaders = null
    }
  }
  return {
    id: row.id,
    runId: row.runId,
    attemptNumber: row.attemptNumber,
    startedAt: row.startedAt.toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
    httpStatus: row.httpStatus,
    failureKind: row.failureKind as AttemptDetail['failureKind'],
    requestBodyR2Key: row.requestBodyR2Key,
    responseBodyR2Key: row.responseBodyR2Key,
    requestHeaders,
  }
}

export async function getRunDetail(
  db: Database,
  workspaceSlug: string,
  jobSlug: string,
  runId: string,
): Promise<RunDetailResponse | null> {
  const joined = await db
    .select({ run: runs, job: jobs, workspace: workspaces, target: targets })
    .from(runs)
    .innerJoin(jobs, eq(jobs.id, runs.jobId))
    .innerJoin(workspaces, eq(workspaces.id, runs.workspaceId))
    .innerJoin(targets, eq(targets.id, jobs.targetId))
    .where(and(eq(runs.id, runId), eq(workspaces.slug, workspaceSlug), eq(jobs.slug, jobSlug)))
    .limit(1)
  const row = joined[0]
  if (!row) return null

  const attemptRows = await db
    .select()
    .from(attempts)
    .where(eq(attempts.runId, runId))
    .orderBy(asc(attempts.attemptNumber))

  const status = row.run.status as RunDetailResponse['run']['status']
  const outcome = (row.run.outcome as RunDetailResponse['run']['outcome']) ?? null

  return {
    run: {
      id: row.run.id,
      jobId: row.run.jobId,
      workspaceId: row.run.workspaceId,
      scheduledAt: row.run.scheduledAt.toISOString(),
      startedAt: row.run.startedAt?.toISOString() ?? null,
      completedAt: row.run.completedAt?.toISOString() ?? null,
      status,
      outcome,
      triggerSource: row.run.triggerSource as TriggerSource,
      skippedReason: row.run.skippedReason,
      createdAt: row.run.createdAt.toISOString(),
      updatedAt: row.run.updatedAt.toISOString(),
    },
    job: {
      id: row.job.id,
      slug: row.job.slug,
      name: row.job.name,
      status: row.job.status as RunDetailResponse['job']['status'],
    },
    workspace: {
      id: row.workspace.id,
      slug: row.workspace.slug,
      name: row.workspace.name,
      timezone: row.workspace.timezone,
    },
    target: {
      id: row.target.id,
      slug: row.target.slug,
      name: row.target.name,
      url: row.target.url,
      method: row.target.method,
    },
    attempts: attemptRows.map(toAttemptDetail),
    displayOutcome: computeDisplayOutcome({
      status,
      outcome,
      skippedReason: row.run.skippedReason,
    }),
  }
}
