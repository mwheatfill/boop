import { eq } from 'drizzle-orm'
import type { Database } from '@/lib/db/client'
import { workspaces } from '@/lib/db/schema'
import { FieldValidationError, NotFoundError } from '@/lib/errors'
import { slugify } from '@/lib/slug/slugify'

export function normalizeSlug(raw: string): string {
  const slug = slugify(raw)
  if (slug.length === 0) {
    throw new FieldValidationError({ slug: ['Slug must contain letters or digits'] })
  }
  return slug
}

export async function resolveWorkspaceId(db: Database, workspaceSlug: string): Promise<string> {
  const row = (
    await db
      .select({ id: workspaces.id })
      .from(workspaces)
      .where(eq(workspaces.slug, workspaceSlug))
      .limit(1)
  )[0]
  if (!row) throw new NotFoundError('Workspace', workspaceSlug)
  return row.id
}
