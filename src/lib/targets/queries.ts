import { and, asc, eq } from 'drizzle-orm'
import type { Database } from '@/lib/db/client'
import { customers, targets } from '@/lib/db/schema'
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
    customerId: row.customerId,
    name: row.name,
    slug: row.slug,
    url: row.url,
    method: row.method as (typeof TARGET_METHODS)[number],
    authKind: row.authKind as (typeof TARGET_AUTH_KINDS)[number],
    authConfig: row.authConfig,
    reachability: row.reachability as (typeof TARGET_REACHABILITIES)[number],
    status: row.status as Target['status'],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export async function listTargetsForCustomer(
  db: Database,
  customerSlug: string,
  { includeArchived = false }: { includeArchived?: boolean } = {},
): Promise<Target[]> {
  const customer = (
    await db.select().from(customers).where(eq(customers.slug, customerSlug)).limit(1)
  )[0]
  if (!customer) throw new NotFoundError('Customer', customerSlug)
  const rows = includeArchived
    ? await db
        .select()
        .from(targets)
        .where(eq(targets.customerId, customer.id))
        .orderBy(asc(targets.name))
    : await db
        .select()
        .from(targets)
        .where(and(eq(targets.customerId, customer.id), eq(targets.status, 'active')))
        .orderBy(asc(targets.name))
  return rows.map(toTarget)
}

export async function getTargetBySlug(
  db: Database,
  customerSlug: string,
  targetSlug: string,
): Promise<Target> {
  const customer = (
    await db.select().from(customers).where(eq(customers.slug, customerSlug)).limit(1)
  )[0]
  if (!customer) throw new NotFoundError('Customer', customerSlug)
  const row = (
    await db
      .select()
      .from(targets)
      .where(and(eq(targets.customerId, customer.id), eq(targets.slug, targetSlug)))
      .limit(1)
  )[0]
  if (!row) throw new NotFoundError('Target', `${customerSlug}/${targetSlug}`)
  return toTarget(row)
}
