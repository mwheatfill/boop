import { and, eq } from 'drizzle-orm'
import type { Database } from '@/lib/db/client'
import { alertRules, channels, jobs, targets } from '@/lib/db/schema'
import { NotFoundError } from '@/lib/errors'
import { resolveWorkspaceId } from '@/lib/workspaces/resolve'
import type { DeletedKind } from './queries'

export type PurgeResult = { ok: true } | { ok: false; message: string }

const PURGE = {
  job: { table: jobs, label: 'Job' },
  target: { table: targets, label: 'Target' },
  channel: { table: channels, label: 'Channel' },
  'alert-rule': { table: alertRules, label: 'alert rule' },
} as const

// Permanently removes a soft-deleted row. Only operates on items already in the bin
// (status='archived'). A Job's children (runs, attempts, alert rules, webhook secrets)
// cascade via their FKs; a Target blocks while any Job still references it (FK is
// restrict — purge those Jobs first). Tunnels purge via purgeTunnel (Cloudflare
// teardown) in the server fn.
export async function purgeDeleted(
  db: Database,
  kind: Exclude<DeletedKind, 'tunnel'>,
  workspaceSlug: string,
  slug: string,
): Promise<PurgeResult> {
  const workspaceId = await resolveWorkspaceId(db, workspaceSlug)
  const { table, label } = PURGE[kind]
  const row = (
    await db
      .select({ id: table.id, status: table.status })
      .from(table)
      .where(and(eq(table.workspaceId, workspaceId), eq(table.slug, slug)))
      .limit(1)
  )[0]
  if (!row) throw new NotFoundError(label, slug)
  if (row.status !== 'archived') {
    return { ok: false, message: `Delete this ${label} before deleting it permanently.` }
  }
  if (kind === 'target') {
    const refs = await db.select({ id: jobs.id }).from(jobs).where(eq(jobs.targetId, row.id))
    if (refs.length > 0) {
      return {
        ok: false,
        message: `This Target still has ${refs.length} Job(s). Delete those permanently first.`,
      }
    }
  }
  await db.delete(table).where(eq(table.id, row.id))
  return { ok: true }
}
