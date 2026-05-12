import { asc, eq } from 'drizzle-orm'
import type { Database } from '@/lib/db/client'
import { customers } from '@/lib/db/schema'
import { NotFoundError } from '@/lib/errors'
import type { Customer } from '@/shared/schemas/customer'

function toCustomer(row: typeof customers.$inferSelect): Customer {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    timezone: row.timezone,
    autotaskCompanyId: row.autotaskCompanyId,
    status: row.status as Customer['status'],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export async function listCustomers(
  db: Database,
  { includeArchived = false }: { includeArchived?: boolean } = {},
): Promise<Customer[]> {
  const base = db.select().from(customers).orderBy(asc(customers.name))
  const rows = includeArchived
    ? await base
    : await db
        .select()
        .from(customers)
        .where(eq(customers.status, 'active'))
        .orderBy(asc(customers.name))
  return rows.map(toCustomer)
}

export async function getCustomerBySlug(db: Database, slug: string): Promise<Customer> {
  const rows = await db.select().from(customers).where(eq(customers.slug, slug)).limit(1)
  const row = rows[0]
  if (!row) throw new NotFoundError('Customer', slug)
  return toCustomer(row)
}

export async function countCustomers(db: Database): Promise<number> {
  const rows = await db.select({ id: customers.id }).from(customers)
  return rows.length
}

const ORG_TIMEZONE_FALLBACK = 'America/Phoenix'

export async function getOrgTimezone(db: Database): Promise<string> {
  const orgRows = await db
    .select({ timezone: customers.timezone })
    .from(customers)
    .where(eq(customers.slug, 'switchthink'))
    .limit(1)
  if (orgRows[0]) return orgRows[0].timezone

  const earliest = await db
    .select({ timezone: customers.timezone })
    .from(customers)
    .orderBy(asc(customers.createdAt))
    .limit(1)
  return earliest[0]?.timezone ?? ORG_TIMEZONE_FALLBACK
}
