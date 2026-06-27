import { env } from 'cloudflare:workers'
import { createServerFn } from '@tanstack/react-start'
import { adminMiddleware } from '@/lib/auth/admin-middleware'
import { authMiddleware } from '@/lib/auth/auth-middleware'
import { createDb } from '@/lib/db/client'
import { asMutationFailure, type MutationResult } from '@/lib/mutation-result'
import { z } from '@/shared/schemas/openapi'
import type { Workspace } from '@/shared/schemas/workspace'
import { WorkspaceCreateInput, WorkspaceUpdateInput } from '@/shared/schemas/workspace'
import { archiveWorkspace, createWorkspace, restoreWorkspace, updateWorkspace } from './commands'
import {
  countWorkspaces,
  getDefaultWorkspace,
  getOrgTimezone,
  getWorkspaceBySlug,
  listWorkspaces,
} from './queries'

export const listWorkspacesFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator((data: { includeArchived?: boolean } | undefined) =>
    z.object({ includeArchived: z.boolean().optional() }).parse(data ?? {}),
  )
  .handler(async ({ data }) =>
    listWorkspaces(createDb(env.DB), data.includeArchived ? { includeArchived: true } : {}),
  )

export const countWorkspacesFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async () => countWorkspaces(createDb(env.DB)))

export const getOrgTimezoneFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(
    async (): Promise<{ timezone: string }> => ({
      timezone: await getOrgTimezone(createDb(env.DB)),
    }),
  )

export const getWorkspaceFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator((data: { slug: string }) => z.object({ slug: z.string().min(1) }).parse(data))
  .handler(async ({ data }) => getWorkspaceBySlug(createDb(env.DB), data.slug))

export const getDefaultWorkspaceFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async () => getDefaultWorkspace(createDb(env.DB)))

export const createWorkspaceFn = createServerFn({ method: 'POST' })
  .middleware([adminMiddleware])
  .inputValidator((data) => WorkspaceCreateInput.parse(data))
  .handler(async ({ data }): Promise<MutationResult<Workspace>> => {
    try {
      const workspace = await createWorkspace(createDb(env.DB), data)
      return { ok: true, data: workspace }
    } catch (err) {
      const failure = asMutationFailure(err)
      if (failure) return failure
      throw err
    }
  })

export const updateWorkspaceFn = createServerFn({ method: 'POST' })
  .middleware([adminMiddleware])
  .inputValidator((data: { slug: string } & z.infer<typeof WorkspaceUpdateInput>) =>
    z
      .object({ slug: z.string().min(1) })
      .extend(WorkspaceUpdateInput.shape)
      .parse(data),
  )
  .handler(async ({ data }): Promise<MutationResult<Workspace>> => {
    const { slug, ...input } = data
    try {
      const workspace = await updateWorkspace(createDb(env.DB), slug, input)
      return { ok: true, data: workspace }
    } catch (err) {
      const failure = asMutationFailure(err)
      if (failure) return failure
      throw err
    }
  })

export const archiveWorkspaceFn = createServerFn({ method: 'POST' })
  .middleware([adminMiddleware])
  .inputValidator((data: { slug: string }) => z.object({ slug: z.string().min(1) }).parse(data))
  .handler(async ({ data }): Promise<MutationResult<Workspace>> => {
    try {
      const workspace = await archiveWorkspace(createDb(env.DB), data.slug)
      return { ok: true, data: workspace }
    } catch (err) {
      const failure = asMutationFailure(err)
      if (failure) return failure
      throw err
    }
  })

export const restoreWorkspaceFn = createServerFn({ method: 'POST' })
  .middleware([adminMiddleware])
  .inputValidator((data: { slug: string }) => z.object({ slug: z.string().min(1) }).parse(data))
  .handler(async ({ data }) => ({
    ok: true as const,
    data: await restoreWorkspace(createDb(env.DB), data.slug),
  }))
