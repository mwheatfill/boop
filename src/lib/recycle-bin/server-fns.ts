import { env } from 'cloudflare:workers'
import { createServerFn } from '@tanstack/react-start'
import { adminMiddleware } from '@/lib/auth/admin-middleware'
import { createDb } from '@/lib/db/client'
import { PurgeInput } from '@/shared/schemas/recycle-bin'
import { type PurgeResult, purgeDeleted } from './commands'
import { type DeletedItem, listDeleted } from './queries'

export const listDeletedFn = createServerFn({ method: 'GET' })
  .middleware([adminMiddleware])
  .handler(async (): Promise<DeletedItem[]> => listDeleted(createDb(env.DB)))

export const purgeDeletedFn = createServerFn({ method: 'POST' })
  .middleware([adminMiddleware])
  .inputValidator((data) => PurgeInput.parse(data))
  .handler(
    async ({ data }): Promise<PurgeResult> =>
      purgeDeleted(createDb(env.DB), data.kind, data.workspaceSlug, data.slug),
  )
