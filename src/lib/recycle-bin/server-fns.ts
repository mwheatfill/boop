import { env } from 'cloudflare:workers'
import { createServerFn } from '@tanstack/react-start'
import { adminMiddleware } from '@/lib/auth/admin-middleware'
import { createDb } from '@/lib/db/client'
import { z } from '@/shared/schemas/openapi'
import { type PurgeResult, purgeDeleted } from './commands'
import { DELETED_KINDS, type DeletedItem, listDeleted } from './queries'

export const listDeletedFn = createServerFn({ method: 'GET' })
  .middleware([adminMiddleware])
  .handler(async (): Promise<DeletedItem[]> => listDeleted(createDb(env.DB)))

const purgeInput = z.object({
  kind: z.enum(DELETED_KINDS),
  workspaceSlug: z.string().min(1),
  slug: z.string().min(1),
})

export const purgeDeletedFn = createServerFn({ method: 'POST' })
  .middleware([adminMiddleware])
  .inputValidator((data) => purgeInput.parse(data))
  .handler(
    async ({ data }): Promise<PurgeResult> =>
      purgeDeleted(createDb(env.DB), data.kind, data.workspaceSlug, data.slug),
  )
