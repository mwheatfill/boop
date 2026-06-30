import { env } from 'cloudflare:workers'
import { createServerFn } from '@tanstack/react-start'
import { authMiddleware } from '@/lib/auth/auth-middleware'
import type { Database } from '@/lib/db/client'
import { createDb } from '@/lib/db/client'
import { enterIntervalMode } from '@/lib/dispatch/trigger-modes'
import { logWarn } from '@/lib/log'
import { asMutationFailure, type MutationResult } from '@/lib/mutation-result'
import { getProviderConfig } from '@/lib/tunnels/provider'
import { syncTunnelIngress } from '@/lib/tunnels/provision'
import { runTargetVerify, runTunnelVerify } from '@/lib/tunnels/verify'
import { z } from '@/shared/schemas/openapi'
import type { Target } from '@/shared/schemas/target'
import { TargetCreateInput, TargetUpdateInput } from '@/shared/schemas/target'
import { archiveTarget, createTarget, restoreTarget, updateTarget } from './commands'
import { getTargetBySlug, listTargetsForTunnel, listTargetsForWorkspace } from './queries'

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

export const listTargetsForTunnelFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator((data: { tunnelId: string }) =>
    z.object({ tunnelId: z.string().min(1) }).parse(data),
  )
  .handler(async ({ data }) => listTargetsForTunnel(createDb(env.DB), data.tunnelId))

export const verifyTargetFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator((data: { targetId: string }) =>
    z.object({ targetId: z.string().min(1) }).parse(data),
  )
  .handler(async ({ data }) => {
    const db = createDb(env.DB)
    const kek = (await env.BOOP_SECRETS_KEK?.get()) ?? ''
    return runTargetVerify({ db, kek }, data.targetId)
  })

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
      // Probe the new Target now so its health resolves immediately instead of
      // sitting at "Checking" until a manual Verify or first Run. Best-effort.
      if (target.reachability === 'tunnel' && target.tunnelId) {
        try {
          const kek = (await env.BOOP_SECRETS_KEK?.get()) ?? ''
          await runTunnelVerify({ db, kek }, target.tunnelId, target.id)
        } catch {
          logWarn('target.create_verify_failed', { targetId: target.id })
        }
      }
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
    const { target, rearmJobIds } = await restoreTarget(db, data.workspaceSlug, data.targetSlug)
    for (const jobId of rearmJobIds) await enterIntervalMode(env, jobId)
    await syncTunnels(db, [target.tunnelId])
    return { ok: true as const, data: target }
  })
