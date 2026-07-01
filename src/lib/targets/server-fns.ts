import { env } from 'cloudflare:workers'
import { createServerFn } from '@tanstack/react-start'
import { authMiddleware } from '@/lib/auth/auth-middleware'
import { createDb } from '@/lib/db/client'
import { enterIntervalMode } from '@/lib/dispatch/trigger-modes'
import { logWarn } from '@/lib/log'
import { type MutationResult, runMutation } from '@/lib/mutation-result'
import { reconcileTunnels } from '@/lib/tunnels/provision'
import { runTargetVerify, runTunnelVerify } from '@/lib/tunnels/verify'
import type { z } from '@/shared/schemas/openapi'
import {
  IncludeArchivedInput,
  TargetSlugPairInput,
  WorkspaceSlugInput,
} from '@/shared/schemas/resource-refs'
import type { Target } from '@/shared/schemas/target'
import { TargetCreateInput, TargetIdInput, TargetUpdateInput } from '@/shared/schemas/target'
import { TunnelIdInput } from '@/shared/schemas/tunnel'
import { archiveTarget, createTarget, restoreTarget, updateTarget } from './commands'
import { getTargetBySlug, listTargetsForTunnel, listTargetsForWorkspace } from './queries'

export const listTargetsForWorkspaceFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator((data: { workspaceSlug: string; includeArchived?: boolean }) =>
    WorkspaceSlugInput.extend(IncludeArchivedInput.shape).parse(data),
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
  .inputValidator((data: { tunnelId: string }) => TunnelIdInput.parse(data))
  .handler(async ({ data }) => listTargetsForTunnel(createDb(env.DB), data.tunnelId))

export const verifyTargetFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator((data: { targetId: string }) => TargetIdInput.parse(data))
  .handler(async ({ data }) => {
    const db = createDb(env.DB)
    const kek = (await env.BOOP_SECRETS_KEK?.get()) ?? ''
    return runTargetVerify({ db, kek }, data.targetId)
  })

export const getTargetFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator((data) => TargetSlugPairInput.parse(data))
  .handler(async ({ data }) =>
    getTargetBySlug(createDb(env.DB), data.workspaceSlug, data.targetSlug),
  )

export const createTargetFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator((data: { workspaceSlug: string } & z.infer<typeof TargetCreateInput>) =>
    WorkspaceSlugInput.extend(TargetCreateInput.shape).parse(data),
  )
  .handler(({ data }): Promise<MutationResult<Target>> => {
    const { workspaceSlug, ...input } = data
    const db = createDb(env.DB)
    return runMutation(async () => {
      const target = await createTarget(db, workspaceSlug, input)
      await reconcileTunnels({ db, env }, [target.tunnelId])
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
      return target
    })
  })

export const updateTargetFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(
    (data: { workspaceSlug: string; targetSlug: string } & z.infer<typeof TargetUpdateInput>) =>
      TargetSlugPairInput.extend(TargetUpdateInput.shape).parse(data),
  )
  .handler(({ data }): Promise<MutationResult<Target>> => {
    const { workspaceSlug, targetSlug, ...input } = data
    const db = createDb(env.DB)
    return runMutation(async () => {
      const before = await getTargetBySlug(db, workspaceSlug, targetSlug)
      const target = await updateTarget(db, workspaceSlug, targetSlug, input)
      await reconcileTunnels({ db, env }, [before.tunnelId, target.tunnelId])
      return target
    })
  })

export const archiveTargetFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator((data) => TargetSlugPairInput.parse(data))
  .handler(({ data }): Promise<MutationResult<Target>> => {
    const db = createDb(env.DB)
    return runMutation(async () => {
      const target = await archiveTarget(db, data.workspaceSlug, data.targetSlug)
      await reconcileTunnels({ db, env }, [target.tunnelId])
      return target
    })
  })

export const restoreTargetFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator((data) => TargetSlugPairInput.parse(data))
  .handler(async ({ data }) => {
    const db = createDb(env.DB)
    const { target, rearmJobIds } = await restoreTarget(db, data.workspaceSlug, data.targetSlug)
    for (const jobId of rearmJobIds) await enterIntervalMode(env, jobId)
    await reconcileTunnels({ db, env }, [target.tunnelId])
    return { ok: true as const, data: target }
  })
