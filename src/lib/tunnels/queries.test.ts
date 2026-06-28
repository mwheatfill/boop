import { describe, expect, it } from 'vitest'
import { newId } from '@/lib/db/ids'
import { tunnels, workspaces } from '@/lib/db/schema'
import { createTestDb } from '@/lib/db/test-db'
import { NotFoundError } from '@/lib/errors'
import { getTunnelBySlug, listTunnels } from './queries'

type Db = ReturnType<typeof createTestDb>
type ConnectorStatus = 'healthy' | 'degraded' | 'down' | 'inactive'
type CertStatus = 'active' | 'pending' | 'error'

async function seedWorkspace(db: Db) {
  const id = newId('cust')
  await db.insert(workspaces).values({ id, name: 'Acme', slug: 'acme', timezone: 'UTC' })
  return id
}

async function seedTunnel(
  db: Db,
  workspaceId: string,
  slug: string,
  connectorStatus: ConnectorStatus | null,
  certStatus: CertStatus | null,
) {
  const id = newId('tnl')
  await db.insert(tunnels).values({
    id,
    workspaceId,
    name: slug,
    slug,
    hostname: `${slug}.tunnels.test`,
    cfTunnelId: `cf_${slug}`,
    cfAccessAppId: 'app',
    cfAccessPolicyId: 'pol',
    cfServiceTokenId: 'st',
    cfDnsRecordId: 'dns',
    cfCertPackId: certStatus ? 'cert' : null,
    certStatus,
    clientIdSecretName: `cf_access_${slug}_client_id`,
    clientSecretSecretName: `cf_access_${slug}_client_secret`,
    connectorStatus,
  })
  return id
}

describe('listTunnels / getTunnelBySlug', () => {
  it('derives operational for a healthy connector with an active cert', async () => {
    const db = createTestDb()
    const workspaceId = await seedWorkspace(db)
    await seedTunnel(db, workspaceId, 'acme-hq', 'healthy', 'active')
    const [tunnel] = await listTunnels(db, workspaceId)
    expect(tunnel?.state).toBe('operational')
  })

  it('derives provisioning while the cert is not yet active', async () => {
    const db = createTestDb()
    const workspaceId = await seedWorkspace(db)
    await seedTunnel(db, workspaceId, 'acme-hq', 'healthy', null)
    const [tunnel] = await listTunnels(db, workspaceId)
    expect(tunnel?.state).toBe('provisioning')
  })

  it('derives install_pending for an active cert with no connector yet', async () => {
    const db = createTestDb()
    const workspaceId = await seedWorkspace(db)
    await seedTunnel(db, workspaceId, 'acme-hq', null, 'active')
    const [tunnel] = await listTunnels(db, workspaceId)
    expect(tunnel?.state).toBe('install_pending')
  })

  it('derives attention for a down connector with an active cert', async () => {
    const db = createTestDb()
    const workspaceId = await seedWorkspace(db)
    await seedTunnel(db, workspaceId, 'acme-hq', 'down', 'active')
    const [tunnel] = await listTunnels(db, workspaceId)
    expect(tunnel?.state).toBe('attention')
  })

  it('getTunnelBySlug returns the tunnel and throws NotFound for an unknown slug', async () => {
    const db = createTestDb()
    const workspaceId = await seedWorkspace(db)
    await seedTunnel(db, workspaceId, 'acme-hq', 'healthy', 'active')
    await expect(getTunnelBySlug(db, workspaceId, 'acme-hq')).resolves.toMatchObject({
      slug: 'acme-hq',
    })
    await expect(getTunnelBySlug(db, workspaceId, 'nope')).rejects.toBeInstanceOf(NotFoundError)
  })
})
