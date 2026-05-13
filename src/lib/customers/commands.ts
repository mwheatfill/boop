import { eq } from 'drizzle-orm'
import { canArchiveCustomer } from '@/lib/archive-policy/archive-policy'
import type { Database } from '@/lib/db/client'
import { newId } from '@/lib/db/ids'
import { customers } from '@/lib/db/schema'
import {
  ArchiveBlockedError,
  FieldValidationError,
  isUniqueConstraintViolation,
  NotFoundError,
} from '@/lib/errors'
import { slugify } from '@/lib/slug/slugify'
import type { Customer, CustomerCreateInput, CustomerUpdateInput } from '@/shared/schemas/customer'
import { getCustomerBySlug } from './queries'

function normalizeSlug(raw: string): string {
  const slug = slugify(raw)
  if (slug.length === 0) {
    throw new FieldValidationError({ slug: ['Slug must contain letters or digits'] })
  }
  return slug
}

export async function createCustomer(db: Database, input: CustomerCreateInput): Promise<Customer> {
  const slug = normalizeSlug(input.slug)
  const id = newId('cust')
  try {
    await db.insert(customers).values({
      id,
      name: input.name.trim(),
      slug,
      timezone: input.timezone,
      autotaskCompanyId: input.autotaskCompanyId ?? null,
    })
  } catch (err) {
    if (isUniqueConstraintViolation(err, 'customers.slug')) {
      throw new FieldValidationError({
        slug: [`Slug '${slug}' is already in use by another Customer`],
      })
    }
    throw err
  }
  return getCustomerBySlug(db, slug)
}

export async function updateCustomer(
  db: Database,
  slug: string,
  input: CustomerUpdateInput,
): Promise<Customer> {
  const result = await db
    .update(customers)
    .set({
      name: input.name.trim(),
      timezone: input.timezone,
      autotaskCompanyId: input.autotaskCompanyId ?? null,
      ...(input.variables !== undefined ? { variables: input.variables } : {}),
      updatedAt: new Date(),
    })
    .where(eq(customers.slug, slug))
    .returning({ id: customers.id })
  if (result.length === 0) throw new NotFoundError('Customer', slug)
  return getCustomerBySlug(db, slug)
}

export async function archiveCustomer(db: Database, slug: string): Promise<Customer> {
  const customer = await getCustomerBySlug(db, slug)
  const check = await canArchiveCustomer(db, customer.id)
  if (!check.ok) throw new ArchiveBlockedError(check.blockingCount, 'customer')
  await db
    .update(customers)
    .set({ status: 'archived', updatedAt: new Date() })
    .where(eq(customers.id, customer.id))
  return getCustomerBySlug(db, slug)
}

export async function restoreCustomer(db: Database, slug: string): Promise<Customer> {
  const result = await db
    .update(customers)
    .set({ status: 'active', updatedAt: new Date() })
    .where(eq(customers.slug, slug))
    .returning({ id: customers.id })
  if (result.length === 0) throw new NotFoundError('Customer', slug)
  return getCustomerBySlug(db, slug)
}
