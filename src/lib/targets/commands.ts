import { and, eq } from 'drizzle-orm'
import { canArchiveTarget } from '@/lib/archive-policy/archive-policy'
import type { Database } from '@/lib/db/client'
import { newId } from '@/lib/db/ids'
import { targets, tunnels } from '@/lib/db/schema'
import {
  ArchiveBlockedError,
  FieldValidationError,
  isUniqueConstraintViolation,
  NotFoundError,
} from '@/lib/errors'
import { tunnelTargetHostname } from '@/lib/tunnels/provision'
import { normalizeSlug, resolveWorkspaceId } from '@/lib/workspaces/resolve'
import type { Target, TargetCreateInput, TargetUpdateInput } from '@/shared/schemas/target'
import { getTargetBySlug } from './queries'

interface RoutingInput {
  reachability: string
  url?: string | undefined
  tunnelId?: string | null | undefined
  internalOrigin?: string | null | undefined
}

// Resolves the persisted routing fields. Public targets carry a user URL; private
// targets carry an internal origin + tunnel, and boop derives the public URL from
// the chosen tunnel's hostname (`<targetSlug>.<tunnelHostname>`).
async function resolveRouting(
  db: Database,
  workspaceId: string,
  targetSlug: string,
  input: RoutingInput,
): Promise<{ url: string; tunnelId: string | null; internalOrigin: string | null }> {
  if (input.reachability !== 'tunnel') {
    if (!input.url) throw new FieldValidationError({ url: ['URL is required'] })
    return { url: input.url, tunnelId: null, internalOrigin: null }
  }
  if (!input.tunnelId) {
    throw new FieldValidationError({ tunnelId: ['Select a tunnel for tunnel reachability'] })
  }
  if (!input.internalOrigin) {
    throw new FieldValidationError({ internalOrigin: ['Enter the internal origin'] })
  }
  const tunnel = (
    await db
      .select()
      .from(tunnels)
      .where(
        and(
          eq(tunnels.id, input.tunnelId),
          eq(tunnels.workspaceId, workspaceId),
          eq(tunnels.status, 'active'),
        ),
      )
      .limit(1)
  )[0]
  if (!tunnel) throw new FieldValidationError({ tunnelId: ['Tunnel not found'] })
  return {
    url: `https://${tunnelTargetHostname(tunnel.hostname, targetSlug)}`,
    tunnelId: input.tunnelId,
    internalOrigin: input.internalOrigin,
  }
}

export async function createTarget(
  db: Database,
  workspaceSlug: string,
  input: TargetCreateInput,
): Promise<Target> {
  const workspaceId = await resolveWorkspaceId(db, workspaceSlug)
  const slug = normalizeSlug(input.slug)
  const routing = await resolveRouting(db, workspaceId, slug, input)
  const id = newId('tgt')
  try {
    await db.insert(targets).values({
      id,
      workspaceId,
      name: input.name.trim(),
      slug,
      url: routing.url,
      method: input.method,
      authKind: input.authKind,
      authConfig: input.authConfig ?? null,
      reachability: input.reachability,
      tunnelId: routing.tunnelId,
      internalOrigin: routing.internalOrigin,
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
  const routing = await resolveRouting(db, workspaceId, targetSlug, input)
  const result = await db
    .update(targets)
    .set({
      name: input.name.trim(),
      url: routing.url,
      method: input.method,
      authKind: input.authKind,
      authConfig: input.authConfig ?? null,
      reachability: input.reachability,
      tunnelId: routing.tunnelId,
      internalOrigin: routing.internalOrigin,
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
