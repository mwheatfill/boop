import { env } from 'cloudflare:workers'
import { createServerFn } from '@tanstack/react-start'
import { adminMiddleware } from '@/lib/auth/admin-middleware'
import { authMiddleware } from '@/lib/auth/auth-middleware'
import { createDb } from '@/lib/db/client'
import { getDefaultWorkspace } from '@/lib/workspaces/queries'
import { z } from '@/shared/schemas/openapi'
import { TunnelCreateInput } from '@/shared/schemas/tunnel'
import { getProviderConfig, type ProviderEnv } from './provider'
import { decommissionTunnel, getTunnelInstall, provisionTunnel, updateTunnel } from './provision'
import { getTunnelBySlug, listTunnels } from './queries'
import { runTunnelVerify } from './verify'

const tunnelIdInput = z.object({ tunnelId: z.string().min(1) })
const tunnelUpdateInput = z.object({
  tunnelId: z.string().min(1),
  name: TunnelCreateInput.shape.name,
})

async function requireKek(): Promise<string> {
  const kek = await env.BOOP_SECRETS_KEK.get()
  if (!kek) throw new Error('BOOP_SECRETS_KEK is not configured for this environment')
  return kek
}

function providerEnv(): ProviderEnv {
  return {
    apiToken: env.CF_PROVIDER_API_TOKEN,
    accountId: env.CF_PROVIDER_ACCOUNT_ID,
    zoneId: env.CF_PROVIDER_ZONE_ID,
    hostnameBase: env.CF_TUNNEL_HOSTNAME_BASE,
  }
}

export const listTunnelsFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async () => {
    const db = createDb(env.DB)
    const workspace = await getDefaultWorkspace(db)
    return listTunnels(db, workspace.id)
  })

export const getTunnelFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator((data) => z.object({ slug: z.string().min(1) }).parse(data))
  .handler(async ({ data }) => {
    const db = createDb(env.DB)
    const workspace = await getDefaultWorkspace(db)
    return getTunnelBySlug(db, workspace.id, data.slug)
  })

export const updateTunnelFn = createServerFn({ method: 'POST' })
  .middleware([adminMiddleware])
  .inputValidator((data) => tunnelUpdateInput.parse(data))
  .handler(async ({ data }) => {
    const db = createDb(env.DB)
    await updateTunnel({ db }, data.tunnelId, { name: data.name })
    return { ok: true as const }
  })

export const getTunnelInstallFn = createServerFn({ method: 'POST' })
  .middleware([adminMiddleware])
  .inputValidator((data) => tunnelIdInput.parse(data))
  .handler(async ({ data }) => {
    const db = createDb(env.DB)
    const provider = getProviderConfig(providerEnv())
    return getTunnelInstall({ db, cf: provider.cf }, data.tunnelId)
  })

export const provisionTunnelFn = createServerFn({ method: 'POST' })
  .middleware([adminMiddleware])
  .inputValidator((data) => TunnelCreateInput.parse(data))
  .handler(async ({ data }) => {
    const db = createDb(env.DB)
    const kek = await requireKek()
    const workspace = await getDefaultWorkspace(db)
    const provider = getProviderConfig(providerEnv())
    return provisionTunnel(
      { db, cf: provider.cf, kek, zoneId: provider.zoneId, hostnameBase: provider.hostnameBase },
      { workspaceId: workspace.id, name: data.name, slug: data.slug },
    )
  })

export const decommissionTunnelFn = createServerFn({ method: 'POST' })
  .middleware([adminMiddleware])
  .inputValidator((data) => tunnelIdInput.parse(data))
  .handler(async ({ data }) => {
    const db = createDb(env.DB)
    const provider = getProviderConfig(providerEnv())
    await decommissionTunnel({ db, cf: provider.cf, zoneId: provider.zoneId }, data.tunnelId)
    return { ok: true as const }
  })

export const verifyTunnelFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator((data) => tunnelIdInput.parse(data))
  .handler(async ({ data }) => {
    const db = createDb(env.DB)
    const kek = await requireKek()
    return runTunnelVerify({ db, kek }, data.tunnelId)
  })
