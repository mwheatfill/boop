import { and, eq } from 'drizzle-orm'
import { canArchiveTarget } from '@/lib/archive-policy/archive-policy'
import type { Database } from '@/lib/db/client'
import { newId } from '@/lib/db/ids'
import { customers, targets } from '@/lib/db/schema'
import {
  ArchiveBlockedError,
  FieldValidationError,
  isUniqueConstraintViolation,
  NotFoundError,
} from '@/lib/errors'
import { slugify } from '@/lib/slug/slugify'
import type { Target, TargetCreateInput, TargetUpdateInput } from '@/shared/schemas/target'
import { getTargetBySlug } from './queries'

function normalizeSlug(raw: string): string {
  const slug = slugify(raw)
  if (slug.length === 0) {
    throw new FieldValidationError({ slug: ['Slug must contain letters or digits'] })
  }
  return slug
}

async function resolveCustomerId(db: Database, customerSlug: string): Promise<string> {
  const row = (
    await db.select().from(customers).where(eq(customers.slug, customerSlug)).limit(1)
  )[0]
  if (!row) throw new NotFoundError('Customer', customerSlug)
  return row.id
}

export async function createTarget(
  db: Database,
  customerSlug: string,
  input: TargetCreateInput,
): Promise<Target> {
  const customerId = await resolveCustomerId(db, customerSlug)
  const slug = normalizeSlug(input.slug)
  const id = newId('tgt')
  try {
    await db.insert(targets).values({
      id,
      customerId,
      name: input.name.trim(),
      slug,
      url: input.url,
      method: input.method,
      authKind: input.authKind,
      authConfig: input.authConfig ?? null,
      reachability: input.reachability,
    })
  } catch (err) {
    if (isUniqueConstraintViolation(err, 'targets.slug')) {
      throw new FieldValidationError({
        slug: [`Slug '${slug}' is already in use by another Target for this Customer`],
      })
    }
    throw err
  }
  return getTargetBySlug(db, customerSlug, slug)
}

export async function updateTarget(
  db: Database,
  customerSlug: string,
  targetSlug: string,
  input: TargetUpdateInput,
): Promise<Target> {
  const customerId = await resolveCustomerId(db, customerSlug)
  const result = await db
    .update(targets)
    .set({
      name: input.name.trim(),
      url: input.url,
      method: input.method,
      authKind: input.authKind,
      authConfig: input.authConfig ?? null,
      reachability: input.reachability,
      updatedAt: new Date(),
    })
    .where(and(eq(targets.customerId, customerId), eq(targets.slug, targetSlug)))
    .returning({ id: targets.id })
  if (result.length === 0) throw new NotFoundError('Target', `${customerSlug}/${targetSlug}`)
  return getTargetBySlug(db, customerSlug, targetSlug)
}

export async function archiveTarget(
  db: Database,
  customerSlug: string,
  targetSlug: string,
): Promise<Target> {
  const target = await getTargetBySlug(db, customerSlug, targetSlug)
  const check = await canArchiveTarget(db, target.id)
  if (!check.ok) throw new ArchiveBlockedError(check.blockingCount, 'target')
  await db
    .update(targets)
    .set({ status: 'archived', updatedAt: new Date() })
    .where(eq(targets.id, target.id))
  return getTargetBySlug(db, customerSlug, targetSlug)
}

export async function restoreTarget(
  db: Database,
  customerSlug: string,
  targetSlug: string,
): Promise<Target> {
  const target = await getTargetBySlug(db, customerSlug, targetSlug)
  await db
    .update(targets)
    .set({ status: 'active', updatedAt: new Date() })
    .where(eq(targets.id, target.id))
  return getTargetBySlug(db, customerSlug, targetSlug)
}
