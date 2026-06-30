import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { newId } from '@/lib/db/ids'
import { targets, tunnels, workspaces } from '@/lib/db/schema'
import { createTestDb } from '@/lib/db/test-db'
import { createSecret } from '@/lib/workspace-secrets/commands'
import { runTargetVerify, runTunnelVerify, verifyTunnelConnection } from './verify'

const KEK = btoa('\0'.repeat(32))
type Db = ReturnType<typeof createTestDb>

function fetchReturning(status: number): typeof fetch {
  return (async () => new Response(null, { status })) as unknown as typeof fetch
}

describe('verifyTunnelConnection', () => {
  it('maps responses to outcomes', async () => {
    expect((await verifyTunnelConnection(fetchReturning(200), 'https://x', {})).outcome).toBe('ok')
    expect((await verifyTunnelConnection(fetchReturning(401), 'https://x', {})).outcome).toBe(
      'unauthorized',
    )
    expect((await verifyTunnelConnection(fetchReturning(403), 'https://x', {})).outcome).toBe(
      'forbidden',
    )
    expect((await verifyTunnelConnection(fetchReturning(500), 'https://x', {})).outcome).toBe(
      'unknown',
    )
  })

  it('maps a fetch rejection to a network outcome', async () => {
    const failing = (async () => {
      throw new TypeError('boom')
    }) as unknown as typeof fetch
    const r = await verifyTunnelConnection(failing, 'https://x', {})
    expect(r).toMatchObject({ ok: false, outcome: 'network' })
  })
})

async function seedTunnel(db: Db) {
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
    clientIdSecretName: 'cid',
    clientSecretSecretName: 'csec',
  })
  return { workspaceId, tunnelId }
}

// runTunnelVerify HEADs a representative active private Target's url, so the
// verify path only runs when at least one such Target references the tunnel.
async function seedActiveTarget(db: Db, workspaceId: string, tunnelId: string) {
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
}

describe('runTunnelVerify', () => {
  it('records a successful verify on the tunnel row', async () => {
    const db = createTestDb()
    const { workspaceId, tunnelId } = await seedTunnel(db)
    await seedActiveTarget(db, workspaceId, tunnelId)
    await createSecret({ db, kek: KEK }, workspaceId, { name: 'cid', plaintext: 'CID' })
    await createSecret({ db, kek: KEK }, workspaceId, { name: 'csec', plaintext: 'CSEC' })

    const result = await runTunnelVerify({ db, kek: KEK, fetchImpl: fetchReturning(200) }, tunnelId)
    expect(result).toMatchObject({ ok: true, outcome: 'ok' })
    const row = (await db.select().from(tunnels).where(eq(tunnels.id, tunnelId)).limit(1))[0]
    expect(row?.lastVerifyOutcome).toBe('ok')
    expect(row?.lastVerifiedAt).not.toBeNull()
  })

  it('records unknown when credentials are missing', async () => {
    const db = createTestDb()
    const { workspaceId, tunnelId } = await seedTunnel(db)
    await seedActiveTarget(db, workspaceId, tunnelId)
    // no secrets created -> buildAccessHeaders throws TunnelCredentialError
    const result = await runTunnelVerify({ db, kek: KEK, fetchImpl: fetchReturning(200) }, tunnelId)
    expect(result.outcome).toBe('unknown')
    const row = (await db.select().from(tunnels).where(eq(tunnels.id, tunnelId)).limit(1))[0]
    expect(row?.lastVerifyOutcome).toBe('unknown')
  })

  it('records unknown when no private Target references the tunnel', async () => {
    const db = createTestDb()
    const { tunnelId } = await seedTunnel(db)
    const result = await runTunnelVerify({ db, kek: KEK, fetchImpl: fetchReturning(200) }, tunnelId)
    expect(result).toMatchObject({
      ok: false,
      outcome: 'unknown',
      detail: 'No private Targets use this tunnel yet.',
    })
    const row = (await db.select().from(tunnels).where(eq(tunnels.id, tunnelId)).limit(1))[0]
    expect(row?.lastVerifyOutcome).toBe('unknown')
  })

  it('probes the named Target (not the representative) when a targetId is given', async () => {
    const db = createTestDb()
    const { workspaceId, tunnelId } = await seedTunnel(db)
    await seedActiveTarget(db, workspaceId, tunnelId)
    const namedId = newId('tgt')
    await db.insert(targets).values({
      id: namedId,
      workspaceId,
      name: 'Health',
      slug: 'health',
      url: 'https://health.t.tunnels.test/health.json',
      method: 'GET',
      reachability: 'tunnel',
      tunnelId,
      internalOrigin: 'http://10.0.0.2:80',
    })
    await createSecret({ db, kek: KEK }, workspaceId, { name: 'cid', plaintext: 'CID' })
    await createSecret({ db, kek: KEK }, workspaceId, { name: 'csec', plaintext: 'CSEC' })

    let probedUrl = ''
    const capture = (async (url: string) => {
      probedUrl = String(url)
      return new Response(null, { status: 200 })
    }) as unknown as typeof fetch

    const result = await runTunnelVerify({ db, kek: KEK, fetchImpl: capture }, tunnelId, namedId)
    expect(result.outcome).toBe('ok')
    expect(probedUrl).toBe('https://health.t.tunnels.test/health.json')
    const row = (await db.select().from(tunnels).where(eq(tunnels.id, tunnelId)).limit(1))[0]
    expect(row?.lastVerifyOutcome).toBe('ok')
  })
})

async function seedTargetOnTunnel(db: Db, workspaceId: string, tunnelId: string) {
  const id = newId('tgt')
  await db.insert(targets).values({
    id,
    workspaceId,
    name: 'API',
    slug: 'api',
    url: 'https://api.t.tunnels.test/health',
    method: 'GET',
    reachability: 'tunnel',
    tunnelId,
    internalOrigin: 'http://10.0.0.1:8080',
  })
  return id
}

describe('runTargetVerify', () => {
  it('probes the specific Target with its tunnel Access headers', async () => {
    const db = createTestDb()
    const { workspaceId, tunnelId } = await seedTunnel(db)
    const targetId = await seedTargetOnTunnel(db, workspaceId, tunnelId)
    await createSecret({ db, kek: KEK }, workspaceId, { name: 'cid', plaintext: 'CID' })
    await createSecret({ db, kek: KEK }, workspaceId, { name: 'csec', plaintext: 'CSEC' })

    let sentHeaders: Record<string, string> = {}
    const fetchImpl = (async (_url: string, init?: RequestInit) => {
      sentHeaders = (init?.headers ?? {}) as Record<string, string>
      return new Response(null, { status: 200 })
    }) as unknown as typeof fetch

    const result = await runTargetVerify({ db, kek: KEK, fetchImpl }, targetId)
    expect(result).toMatchObject({ ok: true, outcome: 'ok' })
    expect(sentHeaders['CF-Access-Client-Id']).toBe('CID')
    expect(sentHeaders['CF-Access-Client-Secret']).toBe('CSEC')
  })

  it('maps an Access rejection to forbidden', async () => {
    const db = createTestDb()
    const { workspaceId, tunnelId } = await seedTunnel(db)
    const targetId = await seedTargetOnTunnel(db, workspaceId, tunnelId)
    await createSecret({ db, kek: KEK }, workspaceId, { name: 'cid', plaintext: 'CID' })
    await createSecret({ db, kek: KEK }, workspaceId, { name: 'csec', plaintext: 'CSEC' })

    const result = await runTargetVerify({ db, kek: KEK, fetchImpl: fetchReturning(403) }, targetId)
    expect(result.outcome).toBe('forbidden')
  })

  it('returns unknown when the Access credentials are missing', async () => {
    const db = createTestDb()
    const { workspaceId, tunnelId } = await seedTunnel(db)
    const targetId = await seedTargetOnTunnel(db, workspaceId, tunnelId)
    const result = await runTargetVerify({ db, kek: KEK, fetchImpl: fetchReturning(200) }, targetId)
    expect(result.ok).toBe(false)
    expect(result.outcome).toBe('unknown')
  })
})
