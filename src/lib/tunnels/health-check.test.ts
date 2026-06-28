import { eq } from 'drizzle-orm'
import { describe, expect, it, vi } from 'vitest'
import type { CloudflareApi } from '@/lib/cloudflare-api/client'
import { newId } from '@/lib/db/ids'
import { jobs, runs, targets, tunnels, workspaces } from '@/lib/db/schema'
import { createTestDb } from '@/lib/db/test-db'
import { createSecret } from '@/lib/workspace-secrets/commands'
import { refreshTunnelHealth } from './health-check'

const KEK = btoa('\0'.repeat(32))
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

const okFetch = (async () => new Response(null, { status: 200 })) as unknown as typeof fetch

async function seed(db: Db) {
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
    cfCertPackId: 'cert',
    certStatus: 'pending',
    clientIdSecretName: 'cid',
    clientSecretSecretName: 'csec',
  })
  // An active private Target gives runTunnelVerify a representative route to HEAD.
  await db.insert(targets).values({
    id: newId('tgt'),
    workspaceId,
    name: 'API',
    slug: 'api',
    url: 'https://api.t.tunnels.test',
    method: 'GET',
    reachability: 'tunnel',
    tunnelId,
    internalOrigin: 'http://10.0.0.1:80',
  })
  await createSecret({ db, kek: KEK }, workspaceId, { name: 'cid', plaintext: 'CID' })
  await createSecret({ db, kek: KEK }, workspaceId, { name: 'csec', plaintext: 'CSEC' })
  return { workspaceId, tunnelId }
}

async function seedRecentRun(db: Db, workspaceId: string, tunnelId: string) {
  const targetId = newId('tgt')
  await db.insert(targets).values({
    id: targetId,
    workspaceId,
    name: 'API',
    slug: `api-${targetId}`,
    url: 'https://t.tunnels.test',
    method: 'GET',
    reachability: 'tunnel',
    tunnelId,
  })
  const jobId = newId('job')
  await db.insert(jobs).values({
    id: jobId,
    workspaceId,
    targetId,
    name: 'J',
    slug: `j-${jobId}`,
    triggerKind: 'cron',
    cronExpression: '* * * * *',
    triggerTimezone: 'UTC',
  })
  await db.insert(runs).values({
    id: newId('run'),
    jobId,
    workspaceId,
    scheduledAt: new Date(),
    completedAt: new Date(),
    status: 'completed',
    outcome: 'success',
  })
}

describe('refreshTunnelHealth', () => {
  it('polls connector status and verifies when stale with no recent Run', async () => {
    const db = createTestDb()
    const { tunnelId } = await seed(db)
    const result = await refreshTunnelHealth({
      db,
      cf: stubCf(),
      kek: KEK,
      zoneId: 'z1',
      fetchImpl: okFetch,
    })
    expect(result).toEqual({ checked: 1, verified: 1 })
    const row = (await db.select().from(tunnels).where(eq(tunnels.id, tunnelId)).limit(1))[0]
    expect(row?.connectorStatus).toBe('healthy')
    expect(row?.connectorCheckedAt).not.toBeNull()
    expect(row?.lastVerifyOutcome).toBe('ok')
    // The cert pack is still issuing, so its status is polled and written.
    expect(row?.certStatus).toBe('active')
  })

  it('skips the verify when a recent Run already exercised the origin', async () => {
    const db = createTestDb()
    const { workspaceId, tunnelId } = await seed(db)
    await seedRecentRun(db, workspaceId, tunnelId)
    const result = await refreshTunnelHealth({
      db,
      cf: stubCf(),
      kek: KEK,
      zoneId: 'z1',
      fetchImpl: okFetch,
    })
    expect(result).toEqual({ checked: 1, verified: 0 })
    const row = (await db.select().from(tunnels).where(eq(tunnels.id, tunnelId)).limit(1))[0]
    expect(row?.connectorStatus).toBe('healthy')
    expect(row?.lastVerifyOutcome).toBeNull()
  })
})
