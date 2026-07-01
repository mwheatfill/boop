import { and, asc, desc, eq, inArray } from 'drizzle-orm'
import type { Database } from '@/lib/db/client'
import { attempts, jobs, runs, targets, tunnels, workspaces } from '@/lib/db/schema'
import { NotFoundError } from '@/lib/errors'
import {
  projectTargetHealth,
  projectTunnel,
  type TunnelInfo,
} from '@/lib/tunnels/health-projection'
import type { TargetRunSignal } from '@/lib/tunnels/target-health'
import type { FailureKind, RunOutcome } from '@/shared/schemas/run'
import type {
  TARGET_AUTH_KINDS,
  TARGET_METHODS,
  TARGET_REACHABILITIES,
  Target,
  TargetHealth,
} from '@/shared/schemas/target'

type TargetRow = typeof targets.$inferSelect

function toTarget(row: TargetRow, health: TargetHealth | null): Target {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    name: row.name,
    slug: row.slug,
    url: row.url,
    method: row.method as (typeof TARGET_METHODS)[number],
    authKind: row.authKind as (typeof TARGET_AUTH_KINDS)[number],
    authConfig: row.authConfig,
    reachability: row.reachability as (typeof TARGET_REACHABILITIES)[number],
    tunnelId: row.tunnelId,
    internalOrigin: row.internalOrigin,
    originHostHeader: row.originHostHeader,
    originServerName: row.originServerName,
    originNoTlsVerify: row.originNoTlsVerify,
    health,
    status: row.status as Target['status'],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

async function loadTunnelInfo(db: Database, tunnelIds: string[]): Promise<Map<string, TunnelInfo>> {
  const info = new Map<string, TunnelInfo>()
  if (tunnelIds.length === 0) return info
  const rows = await db
    .select({
      id: tunnels.id,
      connectorStatus: tunnels.connectorStatus,
      certStatus: tunnels.certStatus,
      lastVerifyOutcome: tunnels.lastVerifyOutcome,
    })
    .from(tunnels)
    .where(inArray(tunnels.id, tunnelIds))
  for (const row of rows) info.set(row.id, projectTunnel(row))
  return info
}

// The latest completed Run per Target, distilled to its representative attempt.
// Two batch queries regardless of list size: latest run per target, then the
// highest-numbered attempt of each of those runs.
async function loadRunSignals(
  db: Database,
  targetIds: string[],
): Promise<Map<string, TargetRunSignal>> {
  const signals = new Map<string, TargetRunSignal>()
  if (targetIds.length === 0) return signals

  const runRows = await db
    .select({
      targetId: jobs.targetId,
      runId: runs.id,
      outcome: runs.outcome,
    })
    .from(runs)
    .innerJoin(jobs, eq(jobs.id, runs.jobId))
    .where(and(inArray(jobs.targetId, targetIds), eq(runs.status, 'completed')))
    .orderBy(desc(runs.completedAt))

  const latestByTarget = new Map<string, { runId: string; outcome: RunOutcome | null }>()
  for (const row of runRows) {
    if (!latestByTarget.has(row.targetId)) {
      latestByTarget.set(row.targetId, { runId: row.runId, outcome: row.outcome ?? null })
    }
  }

  const runIds = [...latestByTarget.values()].map((v) => v.runId)
  const attemptByRun = new Map<
    string,
    { httpStatus: number | null; failureKind: FailureKind | null }
  >()
  if (runIds.length > 0) {
    const attemptRows = await db
      .select({
        runId: attempts.runId,
        httpStatus: attempts.httpStatus,
        failureKind: attempts.failureKind,
      })
      .from(attempts)
      .where(inArray(attempts.runId, runIds))
      .orderBy(desc(attempts.attemptNumber))
    for (const row of attemptRows) {
      if (!attemptByRun.has(row.runId)) {
        attemptByRun.set(row.runId, {
          httpStatus: row.httpStatus,
          failureKind: row.failureKind ?? null,
        })
      }
    }
  }

  for (const [targetId, { runId, outcome }] of latestByTarget) {
    const attempt = attemptByRun.get(runId)
    signals.set(targetId, {
      outcome,
      httpStatus: attempt?.httpStatus ?? null,
      failureKind: attempt?.failureKind ?? null,
    })
  }
  return signals
}

async function resolveHealth(
  db: Database,
  rows: TargetRow[],
): Promise<Map<string, TargetHealth | null>> {
  const tunnelRows = rows.filter(
    (r): r is TargetRow & { tunnelId: string } => r.reachability === 'tunnel' && !!r.tunnelId,
  )
  const [tunnelInfo, runSignals] = await Promise.all([
    loadTunnelInfo(db, [...new Set(tunnelRows.map((r) => r.tunnelId))]),
    loadRunSignals(
      db,
      tunnelRows.map((r) => r.id),
    ),
  ])
  return projectTargetHealth(
    rows.map((r) => ({
      id: r.id,
      reachability: r.reachability as (typeof TARGET_REACHABILITIES)[number],
      tunnelId: r.tunnelId,
    })),
    { tunnelInfo, runSignals },
  )
}

export async function listTargetsForWorkspace(
  db: Database,
  workspaceSlug: string,
  { includeArchived = false }: { includeArchived?: boolean } = {},
): Promise<Target[]> {
  const workspace = (
    await db.select().from(workspaces).where(eq(workspaces.slug, workspaceSlug)).limit(1)
  )[0]
  if (!workspace) throw new NotFoundError('Workspace', workspaceSlug)
  const rows = includeArchived
    ? await db
        .select()
        .from(targets)
        .where(eq(targets.workspaceId, workspace.id))
        .orderBy(asc(targets.name))
    : await db
        .select()
        .from(targets)
        .where(and(eq(targets.workspaceId, workspace.id), eq(targets.status, 'active')))
        .orderBy(asc(targets.name))
  const health = await resolveHealth(db, rows)
  return rows.map((row) => toTarget(row, health.get(row.id) ?? null))
}

export async function listTargetsForTunnel(db: Database, tunnelId: string): Promise<Target[]> {
  const rows = await db
    .select()
    .from(targets)
    .where(and(eq(targets.tunnelId, tunnelId), eq(targets.status, 'active')))
    .orderBy(asc(targets.name))
  const health = await resolveHealth(db, rows)
  return rows.map((row) => toTarget(row, health.get(row.id) ?? null))
}

export async function getTargetBySlug(
  db: Database,
  workspaceSlug: string,
  targetSlug: string,
): Promise<Target> {
  const workspace = (
    await db.select().from(workspaces).where(eq(workspaces.slug, workspaceSlug)).limit(1)
  )[0]
  if (!workspace) throw new NotFoundError('Workspace', workspaceSlug)
  const row = (
    await db
      .select()
      .from(targets)
      .where(and(eq(targets.workspaceId, workspace.id), eq(targets.slug, targetSlug)))
      .limit(1)
  )[0]
  if (!row) throw new NotFoundError('Target', `${workspaceSlug}/${targetSlug}`)
  const health = await resolveHealth(db, [row])
  return toTarget(row, health.get(row.id) ?? null)
}
