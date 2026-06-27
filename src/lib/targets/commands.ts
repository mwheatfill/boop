import { and, eq } from 'drizzle-orm'
import { canArchiveTarget } from '@/lib/archive-policy/archive-policy'
import type { Database } from '@/lib/db/client'
import { newId } from '@/lib/db/ids'
import { targets } from '@/lib/db/schema'
import {
  ArchiveBlockedError,
  FieldValidationError,
  isUniqueConstraintViolation,
  NotFoundError,
} from '@/lib/errors'
import { normalizeSlug, resolveWorkspaceId } from '@/lib/workspaces/resolve'
import type { Target, TargetCreateInput, TargetUpdateInput } from '@/shared/schemas/target'
import { getTargetBySlug } from './queries'

export async function createTarget(
  db: Database,
  workspaceSlug: string,
  input: TargetCreateInput,
): Promise<Target> {
  const workspaceId = await resolveWorkspaceId(db, workspaceSlug)
  const slug = normalizeSlug(input.slug)
  const id = newId('tgt')
  try {
    await db.insert(targets).values({
      id,
      workspaceId,
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
        slug: [`Slug '${slug}' is already in use by another Target for this Workspace`],
      })
    }
    throw err
  }
  return getTargetBySlug(db, workspaceSlug, slug)
}

export async function updateTarget(
  db: Database,
  workspaceSlug: string,
  targetSlug: string,
  input: TargetUpdateInput,
): Promise<Target> {
  const workspaceId = await resolveWorkspaceId(db, workspaceSlug)
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
    .where(and(eq(targets.workspaceId, workspaceId), eq(targets.slug, targetSlug)))
    .returning({ id: targets.id })
  if (result.length === 0) throw new NotFoundError('Target', `${workspaceSlug}/${targetSlug}`)
  return getTargetBySlug(db, workspaceSlug, targetSlug)
}

export async function archiveTarget(
  db: Database,
  workspaceSlug: string,
  targetSlug: string,
): Promise<Target> {
  const target = await getTargetBySlug(db, workspaceSlug, targetSlug)
  const check = await canArchiveTarget(db, target.id)
  if (!check.ok) throw new ArchiveBlockedError(check.blockingCount, 'target')
  await db
    .update(targets)
    .set({ status: 'archived', updatedAt: new Date() })
    .where(eq(targets.id, target.id))
  return getTargetBySlug(db, workspaceSlug, targetSlug)
}

export async function restoreTarget(
  db: Database,
  workspaceSlug: string,
  targetSlug: string,
): Promise<Target> {
  const target = await getTargetBySlug(db, workspaceSlug, targetSlug)
  await db
    .update(targets)
    .set({ status: 'active', updatedAt: new Date() })
    .where(eq(targets.id, target.id))
  return getTargetBySlug(db, workspaceSlug, targetSlug)
}
