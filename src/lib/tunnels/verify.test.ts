import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { newId } from '@/lib/db/ids'
import { tunnels, workspaces } from '@/lib/db/schema'
import { createTestDb } from '@/lib/db/test-db'
import { createSecret } from '@/lib/workspace-secrets/commands'
import { runTunnelVerify, verifyTunnelConnection } from './verify'

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
    internalOrigin: 'http://10.0.0.1:80',
    cfTunnelId: 'cf',
    cfAccessAppId: 'app',
    cfAccessPolicyId: 'pol',
    cfServiceTokenId: 'st',
    clientIdSecretName: 'cid',
    clientSecretSecretName: 'csec',
  })
  return { workspaceId, tunnelId }
}

describe('runTunnelVerify', () => {
  it('records a successful verify on the tunnel row', async () => {
    const db = createTestDb()
    const { workspaceId, tunnelId } = await seedTunnel(db)
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
    const { tunnelId } = await seedTunnel(db)
    // no secrets created -> buildAccessHeaders throws TunnelCredentialError
    const result = await runTunnelVerify({ db, kek: KEK, fetchImpl: fetchReturning(200) }, tunnelId)
    expect(result.outcome).toBe('unknown')
    const row = (await db.select().from(tunnels).where(eq(tunnels.id, tunnelId)).limit(1))[0]
    expect(row?.lastVerifyOutcome).toBe('unknown')
  })
})
