import { eq } from 'drizzle-orm'
import type { Database } from '@/lib/db/client'
import { customers } from '@/lib/db/schema'
import { FieldValidationError, NotFoundError } from '@/lib/errors'
import { slugify } from '@/lib/slug/slugify'

export function normalizeSlug(raw: string): string {
  const slug = slugify(raw)
  if (slug.length === 0) {
    throw new FieldValidationError({ slug: ['Slug must contain letters or digits'] })
  }
  return slug
}

export async function resolveCustomerId(db: Database, customerSlug: string): Promise<string> {
  const row = (
    await db.select().from(customers).where(eq(customers.slug, customerSlug)).limit(1)
  )[0]
  if (!row) throw new NotFoundError('Customer', customerSlug)
  return row.id
}
