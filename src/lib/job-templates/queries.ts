import { and, asc, eq, or, type SQL, sql } from 'drizzle-orm'
import type { Database } from '@/lib/db/client'
import { customers, jobTemplates } from '@/lib/db/schema'
import { NotFoundError } from '@/lib/errors'
import type { JobTemplate } from '@/shared/schemas/job-template'

type TemplateRow = typeof jobTemplates.$inferSelect

interface JoinedTemplateRow extends TemplateRow {
  customer: typeof customers.$inferSelect | null
}

function toTemplate(row: JoinedTemplateRow): JobTemplate {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    scope: row.scope,
    customerId: row.customerId,
    customerSlug: row.customer?.slug ?? null,
    customerName: row.customer?.name ?? null,
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
    .select({ template: jobTemplates, customer: customers })
    .from(jobTemplates)
    .leftJoin(customers, eq(customers.id, jobTemplates.customerId))
  const rows = where
    ? await base.where(where).orderBy(asc(jobTemplates.builtIn), asc(jobTemplates.name))
    : await base.orderBy(asc(jobTemplates.builtIn), asc(jobTemplates.name))
  return rows.map((r) => toTemplate({ ...r.template, customer: r.customer }))
}

export async function listVisibleTemplates(
  db: Database,
  options: { customerSlug?: string; includeArchived?: boolean } = {},
): Promise<JobTemplate[]> {
  const conditions: SQL[] = []
  if (!options.includeArchived) conditions.push(eq(jobTemplates.status, 'active'))
  if (options.customerSlug) {
    conditions.push(
      or(eq(jobTemplates.scope, 'workspace'), eq(customers.slug, options.customerSlug)) ??
        sql`1 = 0`,
    )
  } else {
    conditions.push(eq(jobTemplates.scope, 'workspace'))
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
  scope: 'workspace' | 'customer',
  slug: string,
  customerSlug?: string,
): Promise<JobTemplate> {
  const conditions =
    scope === 'workspace'
      ? and(eq(jobTemplates.scope, 'workspace'), eq(jobTemplates.slug, slug))
      : and(
          eq(jobTemplates.scope, 'customer'),
          eq(jobTemplates.slug, slug),
          eq(customers.slug, customerSlug ?? ''),
        )
  const rows = await selectTemplates(db, conditions)
  const row = rows[0]
  if (!row) throw new NotFoundError('Job template', slug)
  return row
}
