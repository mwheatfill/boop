import { env } from 'cloudflare:workers'
import { createServerFn } from '@tanstack/react-start'
import { adminMiddleware } from '@/lib/auth/admin-middleware'
import { authMiddleware } from '@/lib/auth/auth-middleware'
import { requireAdmin } from '@/lib/auth/require-admin'
import { createDb } from '@/lib/db/client'
import { asMutationFailure, type MutationResult, runMutation } from '@/lib/mutation-result'
import type { User } from '@/shared/schemas/auth'
import {
  type JobTemplate,
  JobTemplateCreateInput,
  JobTemplateSaveFromJobInput,
  JobTemplateUpdateInput,
} from '@/shared/schemas/job-template'
import { z } from '@/shared/schemas/openapi'
import {
  archiveJobTemplate,
  createJobTemplate,
  restoreJobTemplate,
  saveJobAsTemplate,
  seedStarterRecipes,
  updateJobTemplate,
} from './commands'
import { getTemplateById, listVisibleTemplates } from './queries'

const templateIdOnly = z.object({ id: z.string().min(1) })

function requireWorkspaceTemplateAdmin(user: User, template: Pick<JobTemplate, 'scope'>) {
  if (template.scope === 'workspace') {
    requireAdmin(user)
  }
}

export const listJobTemplatesFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator((data: { customerSlug?: string; includeArchived?: boolean } | undefined) =>
    z
      .object({
        customerSlug: z.string().min(1).optional(),
        includeArchived: z.boolean().optional(),
      })
      .parse(data ?? {}),
  )
  .handler(async ({ data }) =>
    listVisibleTemplates(createDb(env.DB), {
      ...(data.customerSlug ? { customerSlug: data.customerSlug } : {}),
      ...(data.includeArchived ? { includeArchived: true } : {}),
    }),
  )

export const getJobTemplateFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator((data) => templateIdOnly.parse(data))
  .handler(async ({ data }) => getTemplateById(createDb(env.DB), data.id))

export const createJobTemplateFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator((data: z.infer<typeof JobTemplateCreateInput>) =>
    JobTemplateCreateInput.parse(data),
  )
  .handler(({ data, context }) => {
    if (data.scope === 'workspace') {
      requireAdmin(context.user)
    }
    return runMutation(() => createJobTemplate(createDb(env.DB), data))
  })

export const updateJobTemplateFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator((data: { id: string } & z.infer<typeof JobTemplateUpdateInput>) =>
    templateIdOnly.extend(JobTemplateUpdateInput.shape).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { id, ...input } = data
    const db = createDb(env.DB)
    requireWorkspaceTemplateAdmin(context.user, await getTemplateById(db, id))
    return runMutation(() => updateJobTemplate(db, id, input))
  })

export const archiveJobTemplateFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator((data) => templateIdOnly.parse(data))
  .handler(async ({ data, context }) => {
    const db = createDb(env.DB)
    requireWorkspaceTemplateAdmin(context.user, await getTemplateById(db, data.id))
    return runMutation(() => archiveJobTemplate(db, data.id))
  })

export const restoreJobTemplateFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator((data) => templateIdOnly.parse(data))
  .handler(async ({ data, context }) => {
    const db = createDb(env.DB)
    requireWorkspaceTemplateAdmin(context.user, await getTemplateById(db, data.id))
    return runMutation(() => restoreJobTemplate(db, data.id))
  })

export const saveJobAsTemplateFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator((data: z.infer<typeof JobTemplateSaveFromJobInput>) =>
    JobTemplateSaveFromJobInput.parse(data),
  )
  .handler(async ({ data, context }): Promise<MutationResult<JobTemplate>> => {
    try {
      if (data.scope === 'workspace') {
        requireAdmin(context.user)
      }
      return { ok: true, data: await saveJobAsTemplate(createDb(env.DB), data) }
    } catch (err) {
      const failure = asMutationFailure(err)
      if (failure) return failure
      throw err
    }
  })

export const seedStarterRecipesFn = createServerFn({ method: 'POST' })
  .middleware([adminMiddleware])
  .handler(async () => ({ changed: await seedStarterRecipes(createDb(env.DB)) }))
