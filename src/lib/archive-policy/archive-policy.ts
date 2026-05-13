import { and, eq, ne } from 'drizzle-orm'
import type { Database } from '@/lib/db/client'
import { alertRules, channels, jobs } from '@/lib/db/schema'

export interface ArchiveCustomerBreakdownEntry {
  customerId: string | null
  count: number
}

export type ArchiveCheck =
  | { ok: true }
  | {
      ok: false
      reason: 'has_active_jobs' | 'has_active_alert_rules'
      blockingCount: number
      breakdown?: ArchiveCustomerBreakdownEntry[]
    }

export async function canArchiveCustomer(db: Database, customerId: string): Promise<ArchiveCheck> {
  const rows = await db
    .select({ id: jobs.id })
    .from(jobs)
    .where(and(eq(jobs.customerId, customerId), ne(jobs.status, 'archived')))
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
  if (!channel?.customerId) return { ok: true }
  const rules = await db
    .select({ id: alertRules.id, channelIds: alertRules.channelIds })
    .from(alertRules)
    .where(and(eq(alertRules.customerId, channel.customerId), eq(alertRules.status, 'active')))
  const blocking = rules.filter((r) => ruleReferencesChannel(r.channelIds, channelId))
  if (blocking.length === 0) return { ok: true }
  return { ok: false, reason: 'has_active_alert_rules', blockingCount: blocking.length }
}

export async function canArchiveWorkspaceChannel(
  db: Database,
  channelId: string,
): Promise<ArchiveCheck> {
  const rules = await db
    .select({
      id: alertRules.id,
      customerId: alertRules.customerId,
      channelIds: alertRules.channelIds,
    })
    .from(alertRules)
    .where(eq(alertRules.status, 'active'))
  const blocking = rules.filter((r) => ruleReferencesChannel(r.channelIds, channelId))
  if (blocking.length === 0) return { ok: true }
  const byCustomer = new Map<string | null, number>()
  for (const r of blocking) {
    byCustomer.set(r.customerId, (byCustomer.get(r.customerId) ?? 0) + 1)
  }
  return {
    ok: false,
    reason: 'has_active_alert_rules',
    blockingCount: blocking.length,
    breakdown: [...byCustomer.entries()].map(([customerId, count]) => ({ customerId, count })),
  }
}
