import { and, asc, eq, isNull, or, type SQL, sql } from 'drizzle-orm'
import type { Database } from '@/lib/db/client'
import { jobTemplates, workspaces } from '@/lib/db/schema'
import { NotFoundError } from '@/lib/errors'
import type { JobTemplate } from '@/shared/schemas/job-template'

type TemplateRow = typeof jobTemplates.$inferSelect

interface JoinedTemplateRow extends TemplateRow {
  workspace: typeof workspaces.$inferSelect | null
}

function toTemplate(row: JoinedTemplateRow): JobTemplate {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    workspaceId: row.workspaceId,
    workspaceSlug: row.workspace?.slug ?? null,
    workspaceName: row.workspace?.name ?? null,
    tag: row.tag,
    icon: row.icon,
    description: row.description,
    triggerKind: row.triggerKind,
    triggerConfig: row.triggerConfig,
    targetRef: row.targetRef,
    bodyTemplate: row.bodyTemplate,
    headersTemplate: row.headersTemplate,
    variables: row.variables,
    maxAttempts: row.maxAttempts,
    overallDeadlineMs: row.overallDeadlineMs,
    builtIn: row.builtIn,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    archivedAt: row.archivedAt?.toISOString() ?? null,
  }
}

async function selectTemplates(db: Database, where?: SQL): Promise<JobTemplate[]> {
  const base = db
    .select({ template: jobTemplates, workspace: workspaces })
    .from(jobTemplates)
    .leftJoin(workspaces, eq(workspaces.id, jobTemplates.workspaceId))
  const rows = where
    ? await base.where(where).orderBy(asc(jobTemplates.builtIn), asc(jobTemplates.name))
    : await base.orderBy(asc(jobTemplates.builtIn), asc(jobTemplates.name))
  return rows.map((r) => toTemplate({ ...r.template, workspace: r.workspace }))
}

export async function listVisibleTemplates(
  db: Database,
  options: { workspaceSlug?: string; includeArchived?: boolean } = {},
): Promise<JobTemplate[]> {
  const conditions: SQL[] = []
  if (!options.includeArchived) conditions.push(eq(jobTemplates.status, 'active'))
  if (options.workspaceSlug) {
    conditions.push(
      or(isNull(jobTemplates.workspaceId), eq(workspaces.slug, options.workspaceSlug)) ??
        sql`1 = 0`,
    )
  } else {
    conditions.push(isNull(jobTemplates.workspaceId))
  }
  return selectTemplates(db, conditions.length > 0 ? and(...conditions) : undefined)
}

export async function getTemplateById(db: Database, id: string): Promise<JobTemplate> {
  const rows = await selectTemplates(db, eq(jobTemplates.id, id))
  const row = rows[0]
  if (!row) throw new NotFoundError('Job template', id)
  return row
}

export async function getTemplateBySlug(
  db: Database,
  slug: string,
  workspaceSlug?: string,
): Promise<JobTemplate> {
  const conditions = workspaceSlug
    ? and(eq(jobTemplates.slug, slug), eq(workspaces.slug, workspaceSlug))
    : and(eq(jobTemplates.slug, slug), isNull(jobTemplates.workspaceId))
  const rows = await selectTemplates(db, conditions)
  const row = rows[0]
  if (!row) throw new NotFoundError('Job template', slug)
  return row
}
