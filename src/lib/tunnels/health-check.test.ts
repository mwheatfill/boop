import { eq } from 'drizzle-orm'
import { describe, expect, it, vi } from 'vitest'
import type { CloudflareApi } from '@/lib/cloudflare-api/client'
import { newId } from '@/lib/db/ids'
import { tunnels, workspaces } from '@/lib/db/schema'
import { createTestDb } from '@/lib/db/test-db'
import { refreshTunnelHealth } from './health-check'

type Db = ReturnType<typeof createTestDb>

function stubCf(): CloudflareApi {
  const noop = vi.fn(async () => {})
  return {
    getTunnelStatus: vi.fn(async () => 'healthy' as const),
    createTunnel: vi.fn(async () => ({ id: 'x' })),
    getTunnelToken: vi.fn(async () => 't'),
    putTunnelIngress: noop,
    deleteTunnel: noop,
    createServiceToken: vi.fn(async () => ({ id: 's', clientId: 'c', clientSecret: 'x' })),
    rotateServiceToken: vi.fn(async () => ({ clientId: 'c', clientSecret: 'x' })),
    deleteServiceToken: noop,
    createAccessPolicy: vi.fn(async () => ({ id: 'p' })),
    deleteAccessPolicy: noop,
    createAccessApp: vi.fn(async () => ({ id: 'a' })),
    deleteAccessApp: noop,
    createDnsRecord: vi.fn(async () => ({ id: 'd' })),
    deleteDnsRecord: noop,
    orderCertPack: vi.fn(async () => ({ id: 'cert' })),
    getCertStatus: vi.fn(async () => 'active' as const),
    deleteCertPack: noop,
  }
}

async function seed(db: Db, opts: { cfCertPackId?: string } = {}) {
  const workspaceId = newId('cust')
  await db.insert(workspaces).values({ id: workspaceId, name: 'A', slug: 'a', timezone: 'UTC' })
  const tunnelId = newId('tnl')
  await db.insert(tunnels).values({
    id: tunnelId,
    workspaceId,
    name: 't',
    slug: 't',
    hostname: 't.tunnels.test',
    cfTunnelId: 'cf',
    cfAccessAppId: 'app',
    cfAccessPolicyId: 'pol',
    cfServiceTokenId: 'st',
    cfCertPackId: opts.cfCertPackId ?? null,
    certStatus: opts.cfCertPackId ? 'pending' : null,
    clientIdSecretName: 'cid',
    clientSecretSecretName: 'csec',
  })
  return { workspaceId, tunnelId }
}

describe('refreshTunnelHealth', () => {
  it('polls connector and certificate status and writes them', async () => {
    const db = createTestDb()
    const { tunnelId } = await seed(db, { cfCertPackId: 'cert' })
    const result = await refreshTunnelHealth({ db, cf: stubCf(), zoneId: 'z1' })
    expect(result).toEqual({ checked: 1 })
    const row = (await db.select().from(tunnels).where(eq(tunnels.id, tunnelId)).limit(1))[0]
    expect(row?.connectorStatus).toBe('healthy')
    expect(row?.connectorCheckedAt).not.toBeNull()
    expect(row?.certStatus).toBe('active')
  })

  it('skips the cert poll when the tunnel has no cert pack', async () => {
    const db = createTestDb()
    const cf = stubCf()
    const { tunnelId } = await seed(db)
    await refreshTunnelHealth({ db, cf, zoneId: 'z1' })
    expect(cf.getCertStatus).not.toHaveBeenCalled()
    const row = (await db.select().from(tunnels).where(eq(tunnels.id, tunnelId)).limit(1))[0]
    expect(row?.connectorStatus).toBe('healthy')
    expect(row?.certStatus).toBeNull()
  })
})
