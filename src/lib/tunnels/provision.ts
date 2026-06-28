import { eq } from 'drizzle-orm'
import { canDecommissionTunnel } from '@/lib/archive-policy/archive-policy'
import type { CloudflareApi } from '@/lib/cloudflare-api/client'
import { CloudflareApiError } from '@/lib/cloudflare-api/errors'
import type { Database } from '@/lib/db/client'
import { newId } from '@/lib/db/ids'
import { tunnels } from '@/lib/db/schema'
import { ArchiveBlockedError, NotFoundError } from '@/lib/errors'
import { logError, logInfo } from '@/lib/log'
import { createSecret, revokeSecret } from '@/lib/workspace-secrets/commands'

export interface ProvisionTunnelDeps {
  db: Database
  cf: CloudflareApi
  kek: string
  zoneId: string
  // The wildcard base, e.g. "tunnels.stlabs.org"; hostnames are "<slug>.<base>".
  hostnameBase: string
  now?: () => Date
}

export interface ProvisionTunnelInput {
  workspaceId: string
  name: string
  slug: string
  internalOrigin: string
}

export interface ProvisionedTunnel {
  id: string
  hostname: string
  // The cloudflared install token, shown once for the on-prem command. Not stored.
  installToken: string
}

function secretNames(slug: string) {
  return {
    clientId: `cf_access_${slug}_client_id`,
    clientSecret: `cf_access_${slug}_client_secret`,
  }
}

// Orchestrates the Cloudflare provisioning sequence with rollback: each step
// pushes a compensation, and any failure runs the compensations in reverse so
// no half-provisioned Cloudflare resources or orphaned secrets are left behind.
export async function provisionTunnel(
  deps: ProvisionTunnelDeps,
  input: ProvisionTunnelInput,
): Promise<ProvisionedTunnel> {
  const { db, cf, kek, zoneId } = deps
  const now = deps.now ?? (() => new Date())
  const hostname = `${input.slug}.${deps.hostnameBase}`
  const names = secretNames(input.slug)
  const compensations: Array<() => Promise<void>> = []

  try {
    const tunnel = await cf.createTunnel(input.name)
    compensations.push(() => cf.deleteTunnel(tunnel.id))

    const installToken = await cf.getTunnelToken(tunnel.id)

    const serviceToken = await cf.createServiceToken(input.name)
    compensations.push(() => cf.deleteServiceToken(serviceToken.id))

    await createSecret({ db, kek, now }, input.workspaceId, {
      name: names.clientId,
      plaintext: serviceToken.clientId,
    })
    compensations.push(async () => {
      await revokeSecret({ db, now }, input.workspaceId, names.clientId)
    })
    await createSecret({ db, kek, now }, input.workspaceId, {
      name: names.clientSecret,
      plaintext: serviceToken.clientSecret,
    })
    compensations.push(async () => {
      await revokeSecret({ db, now }, input.workspaceId, names.clientSecret)
    })

    const policy = await cf.createAccessPolicy(input.name, serviceToken.id)
    compensations.push(() => cf.deleteAccessPolicy(policy.id))

    const app = await cf.createAccessApp(input.name, hostname, [policy.id])
    compensations.push(() => cf.deleteAccessApp(app.id))

    const dns = await cf.createDnsRecord(zoneId, hostname, `${tunnel.id}.cfargotunnel.com`)
    compensations.push(() => cf.deleteDnsRecord(zoneId, dns.id))

    await cf.putTunnelConfiguration(tunnel.id, hostname, input.internalOrigin)

    const id = newId('tnl')
    const createdAt = now()
    await db.insert(tunnels).values({
      id,
      workspaceId: input.workspaceId,
      name: input.name,
      slug: input.slug,
      hostname,
      internalOrigin: input.internalOrigin,
      cfTunnelId: tunnel.id,
      cfAccessAppId: app.id,
      cfAccessPolicyId: policy.id,
      cfServiceTokenId: serviceToken.id,
      cfDnsRecordId: dns.id,
      clientIdSecretName: names.clientId,
      clientSecretSecretName: names.clientSecret,
      createdAt,
      updatedAt: createdAt,
    })

    logInfo('tunnel.provisioned', { workspaceId: input.workspaceId, slug: input.slug, hostname })
    return { id, hostname, installToken }
  } catch (err) {
    logError('tunnel.provision_failed', err, { workspaceId: input.workspaceId, slug: input.slug })
    for (const undo of compensations.reverse()) {
      try {
        await undo()
      } catch (cleanupErr) {
        logError('tunnel.rollback_failed', cleanupErr, { slug: input.slug })
      }
    }
    throw err
  }
}

export interface UpdateTunnelDeps {
  db: Database
  cf: CloudflareApi
  now?: () => Date
}

// Name is a boop-side label (DB only); changing the internal origin re-points the
// connector by rewriting the tunnel's ingress on Cloudflare. Slug/hostname are
// immutable (they anchor DNS and the Access app).
export async function updateTunnel(
  deps: UpdateTunnelDeps,
  tunnelId: string,
  input: { name: string; internalOrigin: string },
): Promise<void> {
  const { db, cf } = deps
  const now = deps.now ?? (() => new Date())
  const row = (await db.select().from(tunnels).where(eq(tunnels.id, tunnelId)).limit(1))[0]
  if (!row) throw new NotFoundError('Tunnel', tunnelId)

  if (input.internalOrigin !== row.internalOrigin) {
    await cf.putTunnelConfiguration(row.cfTunnelId, row.hostname, input.internalOrigin)
  }
  await db
    .update(tunnels)
    .set({ name: input.name, internalOrigin: input.internalOrigin, updatedAt: now() })
    .where(eq(tunnels.id, tunnelId))
  logInfo('tunnel.updated', { workspaceId: row.workspaceId, slug: row.slug })
}

// Re-fetches the cloudflared install token so the connector command can be shown
// again (token is never stored; the install command must not disappear).
export async function getTunnelInstall(
  deps: { db: Database; cf: CloudflareApi },
  tunnelId: string,
): Promise<{ hostname: string; installToken: string }> {
  const row = (await deps.db.select().from(tunnels).where(eq(tunnels.id, tunnelId)).limit(1))[0]
  if (!row) throw new NotFoundError('Tunnel', tunnelId)
  const installToken = await deps.cf.getTunnelToken(row.cfTunnelId)
  return { hostname: row.hostname, installToken }
}

export interface DecommissionTunnelDeps {
  db: Database
  cf: CloudflareApi
  zoneId: string
  now?: () => Date
}

// Deleting an already-gone Cloudflare resource is success for teardown.
async function ignoreMissing(op: () => Promise<unknown>): Promise<void> {
  try {
    await op()
  } catch (err) {
    if (err instanceof CloudflareApiError && err.status === 404) return
    throw err
  }
}

export async function decommissionTunnel(
  deps: DecommissionTunnelDeps,
  tunnelId: string,
): Promise<void> {
  const { db, cf, zoneId } = deps
  const now = deps.now ?? (() => new Date())

  const row = (await db.select().from(tunnels).where(eq(tunnels.id, tunnelId)).limit(1))[0]
  if (!row) throw new NotFoundError('Tunnel', tunnelId)

  const check = await canDecommissionTunnel(db, tunnelId)
  if (!check.ok) throw new ArchiveBlockedError(check.blockingCount, 'tunnel')

  try {
    if (row.cfDnsRecordId) {
      await ignoreMissing(() => cf.deleteDnsRecord(zoneId, row.cfDnsRecordId as string))
    }
    await ignoreMissing(() => cf.deleteAccessApp(row.cfAccessAppId))
    await ignoreMissing(() => cf.deleteAccessPolicy(row.cfAccessPolicyId))
    await ignoreMissing(() => cf.deleteServiceToken(row.cfServiceTokenId))
    await ignoreMissing(() => cf.deleteTunnel(row.cfTunnelId))

    await revokeSecret({ db, now }, row.workspaceId, row.clientIdSecretName)
    await revokeSecret({ db, now }, row.workspaceId, row.clientSecretSecretName)

    const archivedAt = now()
    await db
      .update(tunnels)
      .set({ status: 'archived', archivedAt, updatedAt: archivedAt })
      .where(eq(tunnels.id, tunnelId))

    logInfo('tunnel.decommissioned', { workspaceId: row.workspaceId, slug: row.slug })
  } catch (err) {
    logError('tunnel.decommission_failed', err, { workspaceId: row.workspaceId, slug: row.slug })
    throw err
  }
}
