import { env } from 'cloudflare:workers'
import { createServerFn } from '@tanstack/react-start'
import { adminMiddleware } from '@/lib/auth/admin-middleware'
import { authMiddleware } from '@/lib/auth/auth-middleware'
import { createDb } from '@/lib/db/client'
import { type MutationResult, runMutation } from '@/lib/mutation-result'
import type { z } from '@/shared/schemas/openapi'
import { IncludeArchivedInput, SlugInput } from '@/shared/schemas/resource-refs'
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
    IncludeArchivedInput.parse(data ?? {}),
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
  .inputValidator((data: { slug: string }) => SlugInput.parse(data))
  .handler(async ({ data }) => getWorkspaceBySlug(createDb(env.DB), data.slug))

export const getDefaultWorkspaceFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async () => getDefaultWorkspace(createDb(env.DB)))

export const createWorkspaceFn = createServerFn({ method: 'POST' })
  .middleware([adminMiddleware])
  .inputValidator((data) => WorkspaceCreateInput.parse(data))
  .handler(
    ({ data }): Promise<MutationResult<Workspace>> =>
      runMutation(() => createWorkspace(createDb(env.DB), data)),
  )

export const updateWorkspaceFn = createServerFn({ method: 'POST' })
  .middleware([adminMiddleware])
  .inputValidator((data: { slug: string } & z.infer<typeof WorkspaceUpdateInput>) =>
    SlugInput.extend(WorkspaceUpdateInput.shape).parse(data),
  )
  .handler(({ data }): Promise<MutationResult<Workspace>> => {
    const { slug, ...input } = data
    return runMutation(() => updateWorkspace(createDb(env.DB), slug, input))
  })

export const archiveWorkspaceFn = createServerFn({ method: 'POST' })
  .middleware([adminMiddleware])
  .inputValidator((data: { slug: string }) => SlugInput.parse(data))
  .handler(
    ({ data }): Promise<MutationResult<Workspace>> =>
      runMutation(() => archiveWorkspace(createDb(env.DB), data.slug)),
  )

export const restoreWorkspaceFn = createServerFn({ method: 'POST' })
  .middleware([adminMiddleware])
  .inputValidator((data: { slug: string }) => SlugInput.parse(data))
  .handler(async ({ data }) => ({
    ok: true as const,
    data: await restoreWorkspace(createDb(env.DB), data.slug),
  }))
