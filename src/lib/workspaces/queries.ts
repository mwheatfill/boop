import { asc, eq } from 'drizzle-orm'
import type { Database } from '@/lib/db/client'
import { workspaces } from '@/lib/db/schema'
import { NotFoundError } from '@/lib/errors'
import type { Workspace } from '@/shared/schemas/workspace'

function toWorkspace(row: typeof workspaces.$inferSelect): Workspace {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    timezone: row.timezone,
    autotaskCompanyId: row.autotaskCompanyId,
    status: row.status as Workspace['status'],
    variables: row.variables,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export async function listWorkspaces(
  db: Database,
  { includeArchived = false }: { includeArchived?: boolean } = {},
): Promise<Workspace[]> {
  const base = db.select().from(workspaces).orderBy(asc(workspaces.name))
  const rows = includeArchived
    ? await base
    : await db
        .select()
        .from(workspaces)
        .where(eq(workspaces.status, 'active'))
        .orderBy(asc(workspaces.name))
  return rows.map(toWorkspace)
}

export async function getWorkspaceBySlug(db: Database, slug: string): Promise<Workspace> {
  const rows = await db.select().from(workspaces).where(eq(workspaces.slug, slug)).limit(1)
  const row = rows[0]
  if (!row) throw new NotFoundError('Workspace', slug)
  return toWorkspace(row)
}

// The single scope seam: today there is one Workspace and this returns it.
// When multi-Workspace returns, this becomes "the Workspaces the operator can
// see" and every scoped query filters by it, with no route or schema change.
export async function getDefaultWorkspace(db: Database): Promise<Workspace> {
  const earliest = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.status, 'active'))
    .orderBy(asc(workspaces.createdAt))
    .limit(1)
  const row = earliest[0]
  if (!row) throw new NotFoundError('Workspace', 'default')
  return toWorkspace(row)
}

export async function countWorkspaces(db: Database): Promise<number> {
  const rows = await db.select({ id: workspaces.id }).from(workspaces)
  return rows.length
}

const ORG_TIMEZONE_FALLBACK = 'America/Phoenix'

export async function getOrgTimezone(db: Database): Promise<string> {
  const rows = await db
    .select({ timezone: workspaces.timezone })
    .from(workspaces)
    .where(eq(workspaces.status, 'active'))
    .orderBy(asc(workspaces.createdAt))
    .limit(1)
  return rows[0]?.timezone ?? ORG_TIMEZONE_FALLBACK
}
