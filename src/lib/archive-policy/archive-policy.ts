import { and, eq, ne } from 'drizzle-orm'
import type { Database } from '@/lib/db/client'
import { jobs } from '@/lib/db/schema'

export type ArchiveCheck =
  | { ok: true }
  | { ok: false; reason: 'has_active_jobs'; blockingCount: number }

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
