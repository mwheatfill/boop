import { describe, expect, it } from 'vitest'
import { newId } from '@/lib/db/ids'
import { tunnels, workspaces } from '@/lib/db/schema'
import { createTestDb } from '@/lib/db/test-db'
import { createSecret } from '@/lib/workspace-secrets/commands'
import { buildAccessHeaders, TunnelCredentialError } from './access-headers'

const KEK = btoa('\0'.repeat(32))
type Db = ReturnType<typeof createTestDb>

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
    clientIdSecretName: 'cid_name',
    clientSecretSecretName: 'csec_name',
  })
  return { workspaceId, tunnelId }
}

describe('buildAccessHeaders', () => {
  it('returns no headers for a public target', async () => {
    const db = createTestDb()
    const headers = await buildAccessHeaders(
      { db, kek: KEK },
      { reachability: 'public', tunnelId: null, workspaceId: 'w' },
    )
    expect(headers).toEqual({})
  })

  it('returns the CF-Access headers for a tunnel target', async () => {
    const db = createTestDb()
    const { workspaceId, tunnelId } = await seed(db)
    await createSecret({ db, kek: KEK }, workspaceId, { name: 'cid_name', plaintext: 'CID' })
    await createSecret({ db, kek: KEK }, workspaceId, { name: 'csec_name', plaintext: 'CSEC' })
    const headers = await buildAccessHeaders(
      { db, kek: KEK },
      { reachability: 'tunnel', tunnelId, workspaceId },
    )
    expect(headers).toEqual({ 'CF-Access-Client-Id': 'CID', 'CF-Access-Client-Secret': 'CSEC' })
  })

  it('throws TunnelCredentialError when the tunnel is missing', async () => {
    const db = createTestDb()
    const { workspaceId } = await seed(db)
    await expect(
      buildAccessHeaders(
        { db, kek: KEK },
        { reachability: 'tunnel', tunnelId: 'tnl_x', workspaceId },
      ),
    ).rejects.toBeInstanceOf(TunnelCredentialError)
  })

  it('throws TunnelCredentialError when a secret is missing', async () => {
    const db = createTestDb()
    const { workspaceId, tunnelId } = await seed(db)
    await expect(
      buildAccessHeaders({ db, kek: KEK }, { reachability: 'tunnel', tunnelId, workspaceId }),
    ).rejects.toBeInstanceOf(TunnelCredentialError)
  })
})
