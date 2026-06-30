import { and, eq } from 'drizzle-orm'
import type { Database } from '@/lib/db/client'
import { alertRules, channels, jobs, targets, workspaces } from '@/lib/db/schema'
import { NotFoundError } from '@/lib/errors'
import type { DeletedKind } from './queries'

export type PurgeResult = { ok: true } | { ok: false; message: string }

async function resolveWorkspaceId(db: Database, slug: string): Promise<string> {
  const ws = (
    await db
      .select({ id: workspaces.id })
      .from(workspaces)
      .where(eq(workspaces.slug, slug))
      .limit(1)
  )[0]
  if (!ws) throw new NotFoundError('Workspace', slug)
  return ws.id
}

// Permanently removes a soft-deleted row. Only operates on items already in the
// bin (status='archived'). Job children (runs, attempts, alert rules, webhook
// secrets) cascade via their FKs; Targets block while any Job still references
// them (FK is restrict — purge those Jobs first).
export async function purgeDeleted(
  db: Database,
  kind: DeletedKind,
  workspaceSlug: string,
  slug: string,
): Promise<PurgeResult> {
  const workspaceId = await resolveWorkspaceId(db, workspaceSlug)

  switch (kind) {
    case 'job': {
      const row = (
        await db
          .select({ id: jobs.id, status: jobs.status })
          .from(jobs)
          .where(and(eq(jobs.workspaceId, workspaceId), eq(jobs.slug, slug)))
          .limit(1)
      )[0]
      if (!row) throw new NotFoundError('Job', slug)
      if (row.status !== 'archived')
        return { ok: false, message: 'Delete this Job before deleting it permanently.' }
      await db.delete(jobs).where(eq(jobs.id, row.id))
      return { ok: true }
    }
    case 'target': {
      const row = (
        await db
          .select({ id: targets.id, status: targets.status })
          .from(targets)
          .where(and(eq(targets.workspaceId, workspaceId), eq(targets.slug, slug)))
          .limit(1)
      )[0]
      if (!row) throw new NotFoundError('Target', slug)
      if (row.status !== 'archived')
        return { ok: false, message: 'Delete this Target before deleting it permanently.' }
      const refs = await db.select({ id: jobs.id }).from(jobs).where(eq(jobs.targetId, row.id))
      if (refs.length > 0)
        return {
          ok: false,
          message: `This Target still has ${refs.length} Job(s). Delete those permanently first.`,
        }
      await db.delete(targets).where(eq(targets.id, row.id))
      return { ok: true }
    }
    case 'channel': {
      const row = (
        await db
          .select({ id: channels.id, status: channels.status })
          .from(channels)
          .where(and(eq(channels.workspaceId, workspaceId), eq(channels.slug, slug)))
          .limit(1)
      )[0]
      if (!row) throw new NotFoundError('Channel', slug)
      if (row.status !== 'archived')
        return { ok: false, message: 'Delete this Channel before deleting it permanently.' }
      await db.delete(channels).where(eq(channels.id, row.id))
      return { ok: true }
    }
    case 'alert-rule': {
      const row = (
        await db
          .select({ id: alertRules.id, status: alertRules.status })
          .from(alertRules)
          .where(and(eq(alertRules.workspaceId, workspaceId), eq(alertRules.slug, slug)))
          .limit(1)
      )[0]
      if (!row) throw new NotFoundError('Alert rule', slug)
      if (row.status !== 'archived')
        return { ok: false, message: 'Delete this alert rule before deleting it permanently.' }
      await db.delete(alertRules).where(eq(alertRules.id, row.id))
      return { ok: true }
    }
  }
}
