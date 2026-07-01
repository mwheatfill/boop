import { env } from 'cloudflare:workers'
import { createServerFn } from '@tanstack/react-start'
import { adminMiddleware } from '@/lib/auth/admin-middleware'
import { authMiddleware } from '@/lib/auth/auth-middleware'
import { createDb } from '@/lib/db/client'
import { runMutation } from '@/lib/mutation-result'
import {
  JobTemplateCreateInput,
  JobTemplateSaveFromJobInput,
  JobTemplateUpdateInput,
} from '@/shared/schemas/job-template'
import type { z } from '@/shared/schemas/openapi'
import { IdInput, OptionalWorkspaceScopeInput } from '@/shared/schemas/resource-refs'
import {
  archiveJobTemplate,
  createJobTemplate,
  restoreJobTemplate,
  saveJobAsTemplate,
  seedStarterRecipes,
  updateJobTemplate,
} from './commands'
import { getTemplateById, listVisibleTemplates } from './queries'

export const listJobTemplatesFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator((data: { workspaceSlug?: string; includeArchived?: boolean } | undefined) =>
    OptionalWorkspaceScopeInput.parse(data ?? {}),
  )
  .handler(async ({ data }) =>
    listVisibleTemplates(createDb(env.DB), {
      ...(data.workspaceSlug ? { workspaceSlug: data.workspaceSlug } : {}),
      ...(data.includeArchived ? { includeArchived: true } : {}),
    }),
  )

export const getJobTemplateFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator((data) => IdInput.parse(data))
  .handler(async ({ data }) => getTemplateById(createDb(env.DB), data.id))

export const createJobTemplateFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator((data: z.infer<typeof JobTemplateCreateInput>) =>
    JobTemplateCreateInput.parse(data),
  )
  .handler(({ data }) => runMutation(() => createJobTemplate(createDb(env.DB), data)))

export const updateJobTemplateFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator((data: { id: string } & z.infer<typeof JobTemplateUpdateInput>) =>
    IdInput.extend(JobTemplateUpdateInput.shape).parse(data),
  )
  .handler(async ({ data }) => {
    const { id, ...input } = data
    return runMutation(() => updateJobTemplate(createDb(env.DB), id, input))
  })

export const archiveJobTemplateFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator((data) => IdInput.parse(data))
  .handler(async ({ data }) => runMutation(() => archiveJobTemplate(createDb(env.DB), data.id)))

export const restoreJobTemplateFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator((data) => IdInput.parse(data))
  .handler(async ({ data }) => runMutation(() => restoreJobTemplate(createDb(env.DB), data.id)))

export const saveJobAsTemplateFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator((data: z.infer<typeof JobTemplateSaveFromJobInput>) =>
    JobTemplateSaveFromJobInput.parse(data),
  )
  .handler(({ data }) => runMutation(() => saveJobAsTemplate(createDb(env.DB), data)))

export const seedStarterRecipesFn = createServerFn({ method: 'POST' })
  .middleware([adminMiddleware])
  .handler(async () => ({ changed: await seedStarterRecipes(createDb(env.DB)) }))
