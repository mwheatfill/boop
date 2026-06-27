import { eq } from 'drizzle-orm'
import { canArchiveWorkspace } from '@/lib/archive-policy/archive-policy'
import type { Database } from '@/lib/db/client'
import { newId } from '@/lib/db/ids'
import { workspaces } from '@/lib/db/schema'
import {
  ArchiveBlockedError,
  FieldValidationError,
  isUniqueConstraintViolation,
  NotFoundError,
} from '@/lib/errors'
import { slugify } from '@/lib/slug/slugify'
import type {
  Workspace,
  WorkspaceCreateInput,
  WorkspaceUpdateInput,
} from '@/shared/schemas/workspace'
import { getWorkspaceBySlug } from './queries'

function normalizeSlug(raw: string): string {
  const slug = slugify(raw)
  if (slug.length === 0) {
    throw new FieldValidationError({ slug: ['Slug must contain letters or digits'] })
  }
  return slug
}

export async function createWorkspace(
  db: Database,
  input: WorkspaceCreateInput,
): Promise<Workspace> {
  const slug = normalizeSlug(input.slug)
  const id = newId('cust')
  try {
    await db.insert(workspaces).values({
      id,
      name: input.name.trim(),
      slug,
      timezone: input.timezone,
      autotaskCompanyId: input.autotaskCompanyId ?? null,
    })
  } catch (err) {
    if (isUniqueConstraintViolation(err, 'workspaces.slug')) {
      throw new FieldValidationError({
        slug: [`Slug '${slug}' is already in use by another Workspace`],
      })
    }
    throw err
  }
  return getWorkspaceBySlug(db, slug)
}

export async function updateWorkspace(
  db: Database,
  slug: string,
  input: WorkspaceUpdateInput,
): Promise<Workspace> {
  const result = await db
    .update(workspaces)
    .set({
      name: input.name.trim(),
      timezone: input.timezone,
      autotaskCompanyId: input.autotaskCompanyId ?? null,
      ...(input.variables !== undefined ? { variables: input.variables } : {}),
      updatedAt: new Date(),
    })
    .where(eq(workspaces.slug, slug))
    .returning({ id: workspaces.id })
  if (result.length === 0) throw new NotFoundError('Workspace', slug)
  return getWorkspaceBySlug(db, slug)
}

export async function archiveWorkspace(db: Database, slug: string): Promise<Workspace> {
  const workspace = await getWorkspaceBySlug(db, slug)
  const check = await canArchiveWorkspace(db, workspace.id)
  if (!check.ok) throw new ArchiveBlockedError(check.blockingCount, 'workspace')
  await db
    .update(workspaces)
    .set({ status: 'archived', updatedAt: new Date() })
    .where(eq(workspaces.id, workspace.id))
  return getWorkspaceBySlug(db, slug)
}

export async function restoreWorkspace(db: Database, slug: string): Promise<Workspace> {
  const result = await db
    .update(workspaces)
    .set({ status: 'active', updatedAt: new Date() })
    .where(eq(workspaces.slug, slug))
    .returning({ id: workspaces.id })
  if (result.length === 0) throw new NotFoundError('Workspace', slug)
  return getWorkspaceBySlug(db, slug)
}
