import { and, eq, ne, or } from 'drizzle-orm'
import type { Database } from '@/lib/db/client'
import { alertRules, channels, jobs } from '@/lib/db/schema'

export interface ArchiveWorkspaceBreakdownEntry {
  workspaceId: string | null
  count: number
}

export type ArchiveCheck =
  | { ok: true }
  | {
      ok: false
      reason: 'has_active_jobs' | 'has_active_alert_rules'
      blockingCount: number
      breakdown?: ArchiveWorkspaceBreakdownEntry[]
    }

export async function canArchiveWorkspace(
  db: Database,
  workspaceId: string,
): Promise<ArchiveCheck> {
  const rows = await db
    .select({ id: jobs.id })
    .from(jobs)
    .where(and(eq(jobs.workspaceId, workspaceId), ne(jobs.status, 'archived')))
  if (rows.length === 0) return { ok: true }
  return { ok: false, reason: 'has_active_jobs', blockingCount: rows.length }
}

export async function canArchiveTarget(db: Database, targetId: string): Promise<ArchiveCheck> {
  const rows = await db
    .select({ id: jobs.id })
    .from(jobs)
    .where(and(eq(jobs.targetId, targetId), ne(jobs.status, 'archived')))
  if (rows.length === 0) return { ok: true }
  return { ok: false, reason: 'has_active_jobs', blockingCount: rows.length }
}

function ruleReferencesChannel(channelIdsJson: string, channelId: string): boolean {
  try {
    const parsed = JSON.parse(channelIdsJson)
    return Array.isArray(parsed) && parsed.includes(channelId)
  } catch {
    return false
  }
}

export async function canArchiveChannel(db: Database, channelId: string): Promise<ArchiveCheck> {
  const channel = (await db.select().from(channels).where(eq(channels.id, channelId)).limit(1))[0]
  if (!channel?.workspaceId) return { ok: true }
  const rules = await db
    .select({ id: alertRules.id, channelIds: alertRules.channelIds })
    .from(alertRules)
    .leftJoin(jobs, eq(alertRules.jobId, jobs.id))
    .where(
      and(
        eq(alertRules.status, 'active'),
        or(
          eq(alertRules.workspaceId, channel.workspaceId),
          eq(jobs.workspaceId, channel.workspaceId),
        ),
      ),
    )
  const blocking = rules.filter((r) => ruleReferencesChannel(r.channelIds, channelId))
  if (blocking.length === 0) return { ok: true }
  return { ok: false, reason: 'has_active_alert_rules', blockingCount: blocking.length }
}
