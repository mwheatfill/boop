import { eq } from 'drizzle-orm'
import type { Database } from '@/lib/db/client'
import { alertRules, channels, jobs, targets, workspaces } from '@/lib/db/schema'
import { DELETED_KINDS, type DeletedKind } from '@/shared/schemas/recycle-bin'

export { DELETED_KINDS, type DeletedKind }

export interface DeletedItem {
  kind: DeletedKind
  id: string
  name: string
  slug: string
  workspaceSlug: string
  deletedAt: string
}

// Everything currently soft-deleted (status='archived'), across the entities with a
// Recycle Bin home (jobs, targets, channels, alert rules). Tunnels are permanent-delete
// (Cloudflare teardown), so they never appear here.
export async function listDeleted(db: Database): Promise<DeletedItem[]> {
  const cols = (t: typeof jobs | typeof targets | typeof channels | typeof alertRules) => ({
    id: t.id,
    name: t.name,
    slug: t.slug,
    workspaceSlug: workspaces.slug,
    updatedAt: t.updatedAt,
  })
  const [j, t, c, r] = await Promise.all([
    db
      .select(cols(jobs))
      .from(jobs)
      .innerJoin(workspaces, eq(workspaces.id, jobs.workspaceId))
      .where(eq(jobs.status, 'archived')),
    db
      .select(cols(targets))
      .from(targets)
      .innerJoin(workspaces, eq(workspaces.id, targets.workspaceId))
      .where(eq(targets.status, 'archived')),
    db
      .select(cols(channels))
      .from(channels)
      .innerJoin(workspaces, eq(workspaces.id, channels.workspaceId))
      .where(eq(channels.status, 'archived')),
    db
      .select(cols(alertRules))
      .from(alertRules)
      .innerJoin(workspaces, eq(workspaces.id, alertRules.workspaceId))
      .where(eq(alertRules.status, 'archived')),
  ])
  const tag = (kind: DeletedKind, rows: typeof j): DeletedItem[] =>
    rows.map((x) => ({
      kind,
      id: x.id,
      name: x.name,
      slug: x.slug,
      workspaceSlug: x.workspaceSlug,
      deletedAt: x.updatedAt.toISOString(),
    }))
  return [
    ...tag('job', j),
    ...tag('target', t),
    ...tag('channel', c),
    ...tag('alert-rule', r),
  ].sort((a, b) => (a.deletedAt < b.deletedAt ? 1 : -1))
}
