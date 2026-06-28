import { and, asc, eq } from 'drizzle-orm'
import type { Database } from '@/lib/db/client'
import { targets, workspaces } from '@/lib/db/schema'
import { NotFoundError } from '@/lib/errors'
import type {
  TARGET_AUTH_KINDS,
  TARGET_METHODS,
  TARGET_REACHABILITIES,
  Target,
} from '@/shared/schemas/target'

function toTarget(row: typeof targets.$inferSelect): Target {
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
    status: row.status as Target['status'],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
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
  return rows.map(toTarget)
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
  return toTarget(row)
}
