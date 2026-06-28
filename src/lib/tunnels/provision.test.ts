import { eq } from 'drizzle-orm'
import { describe, expect, it, vi } from 'vitest'
import type { CloudflareApi } from '@/lib/cloudflare-api/client'
import { CloudflareApiError } from '@/lib/cloudflare-api/errors'
import { newId } from '@/lib/db/ids'
import { targets, tunnels, workspaces } from '@/lib/db/schema'
import { createTestDb } from '@/lib/db/test-db'
import { ArchiveBlockedError } from '@/lib/errors'
import { fetchActiveSecretPlaintext, listActiveSecrets } from '@/lib/workspace-secrets/commands'
import {
  decommissionTunnel,
  provisionTunnel,
  rotateTunnelCredentials,
  syncTunnelIngress,
} from './provision'

const KEK = btoa('\0'.repeat(32))
const BASE = 'tunnels.test'

function stubCf(overrides: Partial<CloudflareApi> = {}): CloudflareApi {
  return {
    createTunnel: vi.fn(async () => ({ id: 'cf_tnl' })),
    getTunnelToken: vi.fn(async () => 'eyToken'),
    putTunnelIngress: vi.fn(async () => {}),
    getTunnelStatus: vi.fn(async () => 'healthy' as const),
    deleteTunnel: vi.fn(async () => {}),
    createServiceToken: vi.fn(async () => ({ id: 'st', clientId: 'cid', clientSecret: 'csec' })),
    rotateServiceToken: vi.fn(async () => ({ clientId: 'cid2', clientSecret: 'csec2' })),
    deleteServiceToken: vi.fn(async () => {}),
    createAccessPolicy: vi.fn(async () => ({ id: 'pol' })),
    deleteAccessPolicy: vi.fn(async () => {}),
    createAccessApp: vi.fn(async () => ({ id: 'app' })),
    deleteAccessApp: vi.fn(async () => {}),
    createDnsRecord: vi.fn(async () => ({ id: 'dns' })),
    deleteDnsRecord: vi.fn(async () => {}),
    orderCertPack: vi.fn(async () => ({ id: 'cert' })),
    getCertStatus: vi.fn(async () => 'pending' as const),
    deleteCertPack: vi.fn(async () => {}),
    ...overrides,
  }
}

async function seedWorkspace(db: ReturnType<typeof createTestDb>) {
  const id = newId('cust')
  await db.insert(workspaces).values({ id, name: 'Acme', slug: 'acme', timezone: 'UTC' })
  return id
}

const input = (workspaceId: string) => ({
  workspaceId,
  name: 'Acme HQ',
  slug: 'acme-hq',
})

describe('provisionTunnel', () => {
  it('provisions all Cloudflare resources, stores secrets, and writes the row', async () => {
    const db = createTestDb()
    const workspaceId = await seedWorkspace(db)
    const cf = stubCf()

    const result = await provisionTunnel(
      { db, cf, kek: KEK, zoneId: 'z1', hostnameBase: BASE },
      input(workspaceId),
    )

    expect(result.hostname).toBe('acme-hq.tunnels.test')
    expect(result.installToken).toBe('eyToken')
    expect(result.id.startsWith('tnl_')).toBe(true)
    // Provisioning claims the wildcard Access app + DNS; per-Target ingress is
    // added later via syncTunnelIngress, so no ingress call happens at create.
    expect(cf.createAccessApp).toHaveBeenCalledWith('Acme HQ', '*.acme-hq.tunnels.test', ['pol'])
    expect(cf.createDnsRecord).toHaveBeenCalledWith(
      'z1',
      '*.acme-hq.tunnels.test',
      'cf_tnl.cfargotunnel.com',
    )
    // One wildcard advanced cert per tunnel, scoped to the zone apex + wildcard host.
    expect(cf.orderCertPack).toHaveBeenCalledWith('z1', ['tunnels.test', '*.acme-hq.tunnels.test'])
    expect(cf.putTunnelIngress).not.toHaveBeenCalled()

    const row = (await db.select().from(tunnels).where(eq(tunnels.id, result.id)).limit(1))[0]
    expect(row).toMatchObject({
      cfTunnelId: 'cf_tnl',
      cfServiceTokenId: 'st',
      cfAccessPolicyId: 'pol',
      cfAccessAppId: 'app',
      cfDnsRecordId: 'dns',
      cfCertPackId: 'cert',
      certStatus: 'pending',
      clientIdSecretName: 'cf_access_acme-hq_client_id',
      clientSecretSecretName: 'cf_access_acme-hq_client_secret',
      status: 'active',
    })
    const secrets = await listActiveSecrets({ db }, workspaceId)
    expect(secrets.map((s) => s.name).sort()).toEqual([
      'cf_access_acme-hq_client_id',
      'cf_access_acme-hq_client_secret',
    ])
  })

  it('rolls back created resources and secrets when a later step fails', async () => {
    const db = createTestDb()
    const workspaceId = await seedWorkspace(db)
    const cf = stubCf({
      createAccessApp: vi.fn(async () => {
        throw new CloudflareApiError(500, 'POST /access/apps', [{ code: 1, message: 'boom' }])
      }),
    })

    await expect(
      provisionTunnel({ db, cf, kek: KEK, zoneId: 'z1', hostnameBase: BASE }, input(workspaceId)),
    ).rejects.toBeInstanceOf(CloudflareApiError)

    // Compensations for the steps that succeeded ran, in reverse.
    expect(cf.deleteAccessPolicy).toHaveBeenCalledWith('pol')
    expect(cf.deleteServiceToken).toHaveBeenCalledWith('st')
    expect(cf.deleteTunnel).toHaveBeenCalledWith('cf_tnl')
    // DNS and the cert pack were never created, so they are never deleted.
    expect(cf.deleteDnsRecord).not.toHaveBeenCalled()
    expect(cf.deleteCertPack).not.toHaveBeenCalled()

    const rows = await db.select().from(tunnels)
    expect(rows).toHaveLength(0)
    const secrets = await listActiveSecrets({ db }, workspaceId)
    expect(secrets).toHaveLength(0)
  })
})

describe('decommissionTunnel', () => {
  async function seedTunnel(db: ReturnType<typeof createTestDb>, workspaceId: string) {
    const id = newId('tnl')
    await db.insert(tunnels).values({
      id,
      workspaceId,
      name: 'Acme HQ',
      slug: 'acme-hq',
      hostname: 'acme-hq.tunnels.test',
      cfTunnelId: 'cf_tnl',
      cfAccessAppId: 'app',
      cfAccessPolicyId: 'pol',
      cfServiceTokenId: 'st',
      cfDnsRecordId: 'dns',
      cfCertPackId: 'cert',
      clientIdSecretName: 'cf_access_acme-hq_client_id',
      clientSecretSecretName: 'cf_access_acme-hq_client_secret',
    })
    return id
  }

  it('tears down Cloudflare resources and archives the row', async () => {
    const db = createTestDb()
    const workspaceId = await seedWorkspace(db)
    const tunnelId = await seedTunnel(db, workspaceId)
    const cf = stubCf()

    await decommissionTunnel({ db, cf, zoneId: 'z1' }, tunnelId)

    expect(cf.deleteDnsRecord).toHaveBeenCalledWith('z1', 'dns')
    expect(cf.deleteAccessApp).toHaveBeenCalledWith('app')
    expect(cf.deleteAccessPolicy).toHaveBeenCalledWith('pol')
    expect(cf.deleteServiceToken).toHaveBeenCalledWith('st')
    expect(cf.deleteCertPack).toHaveBeenCalledWith('z1', 'cert')
    expect(cf.deleteTunnel).toHaveBeenCalledWith('cf_tnl')

    const row = (await db.select().from(tunnels).where(eq(tunnels.id, tunnelId)).limit(1))[0]
    expect(row?.status).toBe('archived')
  })

  it('ignores already-deleted Cloudflare resources (404) during teardown', async () => {
    const db = createTestDb()
    const workspaceId = await seedWorkspace(db)
    const tunnelId = await seedTunnel(db, workspaceId)
    const cf = stubCf({
      deleteAccessApp: vi.fn(async () => {
        throw new CloudflareApiError(404, 'DELETE app', [{ code: 1, message: 'not found' }])
      }),
    })

    await expect(decommissionTunnel({ db, cf, zoneId: 'z1' }, tunnelId)).resolves.toBeUndefined()
    const row = (await db.select().from(tunnels).where(eq(tunnels.id, tunnelId)).limit(1))[0]
    expect(row?.status).toBe('archived')
  })

  it('blocks decommission while an active Target references the tunnel', async () => {
    const db = createTestDb()
    const workspaceId = await seedWorkspace(db)
    const tunnelId = await seedTunnel(db, workspaceId)
    await db.insert(targets).values({
      id: newId('tgt'),
      workspaceId,
      name: 'API',
      slug: 'api',
      url: 'https://acme-hq.tunnels.test',
      method: 'GET',
      reachability: 'tunnel',
      tunnelId,
    })
    const cf = stubCf()

    await expect(decommissionTunnel({ db, cf, zoneId: 'z1' }, tunnelId)).rejects.toBeInstanceOf(
      ArchiveBlockedError,
    )
    expect(cf.deleteTunnel).not.toHaveBeenCalled()
  })
})

describe('syncTunnelIngress', () => {
  it('rebuilds ingress from active private Targets and excludes archived ones', async () => {
    const db = createTestDb()
    const workspaceId = await seedWorkspace(db)
    const tunnelId = newId('tnl')
    await db.insert(tunnels).values({
      id: tunnelId,
      workspaceId,
      name: 'Acme HQ',
      slug: 'acme-hq',
      hostname: 'acme-hq.tunnels.test',
      cfTunnelId: 'cf_tnl',
      cfAccessAppId: 'app',
      cfAccessPolicyId: 'pol',
      cfServiceTokenId: 'st',
      cfDnsRecordId: 'dns',
      clientIdSecretName: 'cid',
      clientSecretSecretName: 'csec',
    })
    await db.insert(targets).values({
      id: newId('tgt'),
      workspaceId,
      name: 'API',
      slug: 'api',
      url: 'https://api.acme-hq.tunnels.test',
      method: 'GET',
      reachability: 'tunnel',
      tunnelId,
      internalOrigin: 'http://10.0.1.5:8080',
      originHostHeader: 'api.internal.corp',
      originNoTlsVerify: true,
    })
    await db.insert(targets).values({
      id: newId('tgt'),
      workspaceId,
      name: 'Old',
      slug: 'old',
      url: 'https://old.acme-hq.tunnels.test',
      method: 'GET',
      reachability: 'tunnel',
      tunnelId,
      internalOrigin: 'http://10.0.1.9:8080',
      status: 'archived',
    })
    const cf = stubCf()

    await syncTunnelIngress({ db, cf }, tunnelId)

    expect(cf.putTunnelIngress).toHaveBeenCalledWith('cf_tnl', [
      {
        hostname: 'api.acme-hq.tunnels.test',
        service: 'http://10.0.1.5:8080',
        originRequest: { httpHostHeader: 'api.internal.corp', noTLSVerify: true },
      },
    ])
  })
})

describe('rotateTunnelCredentials', () => {
  it('rotates the Cloudflare service token and stores the fresh secrets', async () => {
    const db = createTestDb()
    const workspaceId = await seedWorkspace(db)
    const cf = stubCf()
    const { id } = await provisionTunnel(
      { db, cf, kek: KEK, zoneId: 'z1', hostnameBase: BASE },
      input(workspaceId),
    )

    await rotateTunnelCredentials({ db, cf, kek: KEK }, id)

    expect(cf.rotateServiceToken).toHaveBeenCalledWith('st')
    const clientId = await fetchActiveSecretPlaintext(
      { db, kek: KEK },
      workspaceId,
      'cf_access_acme-hq_client_id',
    )
    const clientSecret = await fetchActiveSecretPlaintext(
      { db, kek: KEK },
      workspaceId,
      'cf_access_acme-hq_client_secret',
    )
    expect(clientId).toBe('cid2')
    expect(clientSecret).toBe('csec2')
  })
})
