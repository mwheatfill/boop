import { env } from 'cloudflare:workers'
import { createServerFn } from '@tanstack/react-start'
import { adminMiddleware } from '@/lib/auth/admin-middleware'
import { authMiddleware } from '@/lib/auth/auth-middleware'
import { createDb } from '@/lib/db/client'
import { getDefaultWorkspace } from '@/lib/workspaces/queries'
import { SlugInput } from '@/shared/schemas/resource-refs'
import {
  TunnelCreateInput,
  TunnelIdInput,
  TunnelMoveTargetsInput,
  TunnelUpdateInput,
} from '@/shared/schemas/tunnel'
import { providerConfigFromEnv } from './provider'
import {
  deleteTunnel,
  getTunnelInstall,
  moveTargetsToTunnel,
  provisionTunnel,
  rotateTunnelCredentials,
  syncTunnelIngress,
  updateTunnel,
} from './provision'
import { getTunnelBySlug, listTunnels } from './queries'
import { runTunnelVerify } from './verify'

async function requireKek(): Promise<string> {
  const kek = await env.BOOP_SECRETS_KEK.get()
  if (!kek) throw new Error('BOOP_SECRETS_KEK is not configured for this environment')
  return kek
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
  .inputValidator((data) => SlugInput.parse(data))
  .handler(async ({ data }) => {
    const db = createDb(env.DB)
    const workspace = await getDefaultWorkspace(db)
    return getTunnelBySlug(db, workspace.id, data.slug)
  })

export const updateTunnelFn = createServerFn({ method: 'POST' })
  .middleware([adminMiddleware])
  .inputValidator((data) => TunnelUpdateInput.parse(data))
  .handler(async ({ data }) => {
    const db = createDb(env.DB)
    await updateTunnel({ db }, data.tunnelId, { name: data.name })
    return { ok: true as const }
  })

export const getTunnelInstallFn = createServerFn({ method: 'POST' })
  .middleware([adminMiddleware])
  .inputValidator((data) => TunnelIdInput.parse(data))
  .handler(async ({ data }) => {
    const db = createDb(env.DB)
    const provider = providerConfigFromEnv(env)
    return getTunnelInstall({ db, cf: provider.cf }, data.tunnelId)
  })

export const provisionTunnelFn = createServerFn({ method: 'POST' })
  .middleware([adminMiddleware])
  .inputValidator((data) => TunnelCreateInput.parse(data))
  .handler(async ({ data }) => {
    const db = createDb(env.DB)
    const kek = await requireKek()
    const workspace = await getDefaultWorkspace(db)
    const provider = providerConfigFromEnv(env)
    return provisionTunnel(
      { db, cf: provider.cf, kek, zoneId: provider.zoneId, hostnameBase: provider.hostnameBase },
      { workspaceId: workspace.id, name: data.name, slug: data.slug },
    )
  })

export const deleteTunnelFn = createServerFn({ method: 'POST' })
  .middleware([adminMiddleware])
  .inputValidator((data) => TunnelIdInput.parse(data))
  .handler(async ({ data }) => {
    const db = createDb(env.DB)
    const provider = providerConfigFromEnv(env)
    await deleteTunnel({ db, cf: provider.cf, zoneId: provider.zoneId }, data.tunnelId)
    return { ok: true as const }
  })

export const moveTargetsToTunnelFn = createServerFn({ method: 'POST' })
  .middleware([adminMiddleware])
  .inputValidator((data) => TunnelMoveTargetsInput.parse(data))
  .handler(async ({ data }) => {
    const db = createDb(env.DB)
    const provider = providerConfigFromEnv(env)
    const moved = await moveTargetsToTunnel(db, data.fromTunnelId, data.toTunnelId)
    await syncTunnelIngress({ db, cf: provider.cf }, data.fromTunnelId)
    await syncTunnelIngress({ db, cf: provider.cf }, data.toTunnelId)
    return { ok: true as const, moved }
  })

export const rotateTunnelCredentialsFn = createServerFn({ method: 'POST' })
  .middleware([adminMiddleware])
  .inputValidator((data) => TunnelIdInput.parse(data))
  .handler(async ({ data }) => {
    const db = createDb(env.DB)
    const kek = await requireKek()
    const provider = providerConfigFromEnv(env)
    await rotateTunnelCredentials({ db, cf: provider.cf, kek }, data.tunnelId)
    return { ok: true as const }
  })

export const verifyTunnelFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator((data) => TunnelIdInput.parse(data))
  .handler(async ({ data }) => {
    const db = createDb(env.DB)
    const kek = await requireKek()
    return runTunnelVerify({ db, kek }, data.tunnelId)
  })
