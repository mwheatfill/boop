import { env } from 'cloudflare:workers'
import { createServerFn } from '@tanstack/react-start'
import { adminMiddleware } from '@/lib/auth/admin-middleware'
import { authMiddleware } from '@/lib/auth/auth-middleware'
import { createDb } from '@/lib/db/client'
import { asMutationFailure, type MutationResult } from '@/lib/mutation-result'
import { z } from '@/shared/schemas/openapi'
import type { Target } from '@/shared/schemas/target'
import { TargetCreateInput, TargetUpdateInput } from '@/shared/schemas/target'
import { archiveTarget, createTarget, restoreTarget, updateTarget } from './commands'
import { getTargetBySlug, listTargetsForCustomer } from './queries'

const slugPair = z.object({
  customerSlug: z.string().min(1),
  targetSlug: z.string().min(1),
})

export const listTargetsForCustomerFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator((data: { customerSlug: string; includeArchived?: boolean }) =>
    z
      .object({ customerSlug: z.string().min(1), includeArchived: z.boolean().optional() })
      .parse(data),
  )
  .handler(async ({ data }) =>
    listTargetsForCustomer(
      createDb(env.DB),
      data.customerSlug,
      data.includeArchived ? { includeArchived: true } : {},
    ),
  )

export const getTargetFn = createServerFn({ method: 'GET' })
  .middleware([adminMiddleware])
  .inputValidator((data) => slugPair.parse(data))
  .handler(async ({ data }) =>
    getTargetBySlug(createDb(env.DB), data.customerSlug, data.targetSlug),
  )

export const createTargetFn = createServerFn({ method: 'POST' })
  .middleware([adminMiddleware])
  .inputValidator((data: { customerSlug: string } & z.infer<typeof TargetCreateInput>) =>
    z
      .object({ customerSlug: z.string().min(1) })
      .extend(TargetCreateInput.shape)
      .parse(data),
  )
  .handler(async ({ data }): Promise<MutationResult<Target>> => {
    const { customerSlug, ...input } = data
    try {
      const target = await createTarget(createDb(env.DB), customerSlug, input)
      return { ok: true, data: target }
    } catch (err) {
      const failure = asMutationFailure(err)
      if (failure) return failure
      throw err
    }
  })

export const updateTargetFn = createServerFn({ method: 'POST' })
  .middleware([adminMiddleware])
  .inputValidator(
    (data: { customerSlug: string; targetSlug: string } & z.infer<typeof TargetUpdateInput>) =>
      slugPair.extend(TargetUpdateInput.shape).parse(data),
  )
  .handler(async ({ data }): Promise<MutationResult<Target>> => {
    const { customerSlug, targetSlug, ...input } = data
    try {
      const target = await updateTarget(createDb(env.DB), customerSlug, targetSlug, input)
      return { ok: true, data: target }
    } catch (err) {
      const failure = asMutationFailure(err)
      if (failure) return failure
      throw err
    }
  })

export const archiveTargetFn = createServerFn({ method: 'POST' })
  .middleware([adminMiddleware])
  .inputValidator((data) => slugPair.parse(data))
  .handler(async ({ data }): Promise<MutationResult<Target>> => {
    try {
      const target = await archiveTarget(createDb(env.DB), data.customerSlug, data.targetSlug)
      return { ok: true, data: target }
    } catch (err) {
      const failure = asMutationFailure(err)
      if (failure) return failure
      throw err
    }
  })

export const restoreTargetFn = createServerFn({ method: 'POST' })
  .middleware([adminMiddleware])
  .inputValidator((data) => slugPair.parse(data))
  .handler(async ({ data }) => ({
    ok: true as const,
    data: await restoreTarget(createDb(env.DB), data.customerSlug, data.targetSlug),
  }))
