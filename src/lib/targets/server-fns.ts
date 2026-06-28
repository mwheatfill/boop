import { env } from 'cloudflare:workers'
import { createServerFn } from '@tanstack/react-start'
import { authMiddleware } from '@/lib/auth/auth-middleware'
import type { Database } from '@/lib/db/client'
import { createDb } from '@/lib/db/client'
import { asMutationFailure, type MutationResult } from '@/lib/mutation-result'
import { getProviderConfig } from '@/lib/tunnels/provider'
import { syncTunnelIngress } from '@/lib/tunnels/provision'
import { z } from '@/shared/schemas/openapi'
import type { Target } from '@/shared/schemas/target'
import { TargetCreateInput, TargetUpdateInput } from '@/shared/schemas/target'
import { archiveTarget, createTarget, restoreTarget, updateTarget } from './commands'
import { getTargetBySlug, listTargetsForWorkspace } from './queries'

const slugPair = z.object({
  workspaceSlug: z.string().min(1),
  targetSlug: z.string().min(1),
})

// Rebuild each affected tunnel's Cloudflare ingress after a Target change so the
// connector routes match the active private Targets. No-op when no tunnels touched.
async function syncTunnels(db: Database, tunnelIds: Array<string | null>): Promise<void> {
  const unique = [...new Set(tunnelIds.filter((id): id is string => Boolean(id)))]
  if (unique.length === 0) return
  const provider = getProviderConfig({
    apiToken: env.CF_PROVIDER_API_TOKEN,
    accountId: env.CF_PROVIDER_ACCOUNT_ID,
    zoneId: env.CF_PROVIDER_ZONE_ID,
    hostnameBase: env.CF_TUNNEL_HOSTNAME_BASE,
  })
  for (const tunnelId of unique) {
    await syncTunnelIngress({ db, cf: provider.cf }, tunnelId)
  }
}

export const listTargetsForWorkspaceFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator((data: { workspaceSlug: string; includeArchived?: boolean }) =>
    z
      .object({ workspaceSlug: z.string().min(1), includeArchived: z.boolean().optional() })
      .parse(data),
  )
  .handler(async ({ data }) =>
    listTargetsForWorkspace(
      createDb(env.DB),
      data.workspaceSlug,
      data.includeArchived ? { includeArchived: true } : {},
    ),
  )

export const getTargetFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator((data) => slugPair.parse(data))
  .handler(async ({ data }) =>
    getTargetBySlug(createDb(env.DB), data.workspaceSlug, data.targetSlug),
  )

export const createTargetFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator((data: { workspaceSlug: string } & z.infer<typeof TargetCreateInput>) =>
    z
      .object({ workspaceSlug: z.string().min(1) })
      .extend(TargetCreateInput.shape)
      .parse(data),
  )
  .handler(async ({ data }): Promise<MutationResult<Target>> => {
    const { workspaceSlug, ...input } = data
    const db = createDb(env.DB)
    try {
      const target = await createTarget(db, workspaceSlug, input)
      await syncTunnels(db, [target.tunnelId])
      return { ok: true, data: target }
    } catch (err) {
      const failure = asMutationFailure(err)
      if (failure) return failure
      throw err
    }
  })

export const updateTargetFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(
    (data: { workspaceSlug: string; targetSlug: string } & z.infer<typeof TargetUpdateInput>) =>
      slugPair.extend(TargetUpdateInput.shape).parse(data),
  )
  .handler(async ({ data }): Promise<MutationResult<Target>> => {
    const { workspaceSlug, targetSlug, ...input } = data
    const db = createDb(env.DB)
    try {
      const before = await getTargetBySlug(db, workspaceSlug, targetSlug)
      const target = await updateTarget(db, workspaceSlug, targetSlug, input)
      await syncTunnels(db, [before.tunnelId, target.tunnelId])
      return { ok: true, data: target }
    } catch (err) {
      const failure = asMutationFailure(err)
      if (failure) return failure
      throw err
    }
  })

export const archiveTargetFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator((data) => slugPair.parse(data))
  .handler(async ({ data }): Promise<MutationResult<Target>> => {
    const db = createDb(env.DB)
    try {
      const target = await archiveTarget(db, data.workspaceSlug, data.targetSlug)
      await syncTunnels(db, [target.tunnelId])
      return { ok: true, data: target }
    } catch (err) {
      const failure = asMutationFailure(err)
      if (failure) return failure
      throw err
    }
  })

export const restoreTargetFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator((data) => slugPair.parse(data))
  .handler(async ({ data }) => {
    const db = createDb(env.DB)
    const target = await restoreTarget(db, data.workspaceSlug, data.targetSlug)
    await syncTunnels(db, [target.tunnelId])
    return { ok: true as const, data: target }
  })
