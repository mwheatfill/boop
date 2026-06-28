import { and, asc, count, eq, gte, isNotNull, sql } from 'drizzle-orm'
import type { Database } from '@/lib/db/client'
import { jobs, runs, targets, tunnels } from '@/lib/db/schema'
import { NotFoundError } from '@/lib/errors'
import type { Tunnel } from '@/shared/schemas/tunnel'
import { getTunnelHealth, type TunnelHealth } from './health'

const RECENT_RUN_WINDOW_MS = 60 * 60 * 1000

type TunnelRow = typeof tunnels.$inferSelect

async function recentRunStats(
  db: Database,
  tunnelId: string,
  since: Date,
): Promise<{ total: number; failures: number }> {
  const [agg] = await db
    .select({
      total: count(),
      failures: sql<number>`sum(case when ${runs.outcome} != 'success' then 1 else 0 end)`,
    })
    .from(runs)
    .innerJoin(jobs, eq(runs.jobId, jobs.id))
    .innerJoin(targets, eq(jobs.targetId, targets.id))
    .where(
      and(eq(targets.tunnelId, tunnelId), isNotNull(runs.outcome), gte(runs.completedAt, since)),
    )
  return {
    total: agg?.total ?? 0,
    failures: Number(agg?.failures ?? 0),
  }
}

function toTunnel(row: TunnelRow, health: TunnelHealth): Tunnel {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    name: row.name,
    slug: row.slug,
    hostname: row.hostname,
    internalOrigin: row.internalOrigin,
    connectorStatus: row.connectorStatus ?? null,
    connectorCheckedAt: row.connectorCheckedAt ? row.connectorCheckedAt.toISOString() : null,
    lastVerifyOutcome: row.lastVerifyOutcome ?? null,
    lastVerifiedAt: row.lastVerifiedAt ? row.lastVerifiedAt.toISOString() : null,
    health,
    status: row.status as Tunnel['status'],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

async function withHealth(db: Database, row: TunnelRow, since: Date): Promise<Tunnel> {
  const stats = await recentRunStats(db, row.id, since)
  const health = getTunnelHealth({
    connectorStatus: row.connectorStatus ?? null,
    lastVerifyOutcome: row.lastVerifyOutcome ?? null,
    recentRunTotal: stats.total,
    recentRunFailures: stats.failures,
  })
  return toTunnel(row, health)
}

export async function listTunnels(
  db: Database,
  workspaceId: string,
  now: () => Date = () => new Date(),
): Promise<Tunnel[]> {
  const rows = await db
    .select()
    .from(tunnels)
    .where(and(eq(tunnels.workspaceId, workspaceId), eq(tunnels.status, 'active')))
    .orderBy(asc(tunnels.name))
  const since = new Date(now().getTime() - RECENT_RUN_WINDOW_MS)
  return Promise.all(rows.map((row) => withHealth(db, row, since)))
}

export async function getTunnelBySlug(
  db: Database,
  workspaceId: string,
  slug: string,
  now: () => Date = () => new Date(),
): Promise<Tunnel> {
  const row = (
    await db
      .select()
      .from(tunnels)
      .where(and(eq(tunnels.workspaceId, workspaceId), eq(tunnels.slug, slug)))
      .limit(1)
  )[0]
  if (!row) throw new NotFoundError('Tunnel', slug)
  const since = new Date(now().getTime() - RECENT_RUN_WINDOW_MS)
  return withHealth(db, row, since)
}
