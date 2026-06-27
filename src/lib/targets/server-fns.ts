import { env } from 'cloudflare:workers'
import { createServerFn } from '@tanstack/react-start'
import { authMiddleware } from '@/lib/auth/auth-middleware'
import { createDb } from '@/lib/db/client'
import { asMutationFailure, type MutationResult } from '@/lib/mutation-result'
import { z } from '@/shared/schemas/openapi'
import type { Target } from '@/shared/schemas/target'
import { TargetCreateInput, TargetUpdateInput } from '@/shared/schemas/target'
import { archiveTarget, createTarget, restoreTarget, updateTarget } from './commands'
import { getTargetBySlug, listTargetsForWorkspace } from './queries'

const slugPair = z.object({
  workspaceSlug: z.string().min(1),
  targetSlug: z.string().min(1),
})

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
    try {
      const target = await createTarget(createDb(env.DB), workspaceSlug, input)
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
    try {
      const target = await updateTarget(createDb(env.DB), workspaceSlug, targetSlug, input)
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
    try {
      const target = await archiveTarget(createDb(env.DB), data.workspaceSlug, data.targetSlug)
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
  .handler(async ({ data }) => ({
    ok: true as const,
    data: await restoreTarget(createDb(env.DB), data.workspaceSlug, data.targetSlug),
  }))
