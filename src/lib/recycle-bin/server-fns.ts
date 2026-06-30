import { env } from 'cloudflare:workers'
import { createServerFn } from '@tanstack/react-start'
import { adminMiddleware } from '@/lib/auth/admin-middleware'
import { createDb } from '@/lib/db/client'
import { getProviderConfig } from '@/lib/tunnels/provider'
import { purgeTunnel } from '@/lib/tunnels/provision'
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
  .handler(async ({ data }): Promise<PurgeResult> => {
    const db = createDb(env.DB)
    if (data.kind === 'tunnel') {
      const provider = getProviderConfig({
        apiToken: env.CF_PROVIDER_API_TOKEN,
        accountId: env.CF_PROVIDER_ACCOUNT_ID,
        zoneId: env.CF_PROVIDER_ZONE_ID,
        hostnameBase: env.CF_TUNNEL_HOSTNAME_BASE,
      })
      return purgeTunnel(
        { db, cf: provider.cf, zoneId: provider.zoneId },
        data.workspaceSlug,
        data.slug,
      )
    }
    return purgeDeleted(db, data.kind, data.workspaceSlug, data.slug)
  })
