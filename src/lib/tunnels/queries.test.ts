import { describe, expect, it } from 'vitest'
import { newId } from '@/lib/db/ids'
import { jobs, runs, targets, tunnels, workspaces } from '@/lib/db/schema'
import { createTestDb } from '@/lib/db/test-db'
import { NotFoundError } from '@/lib/errors'
import { getTunnelBySlug, listTunnels } from './queries'

type Db = ReturnType<typeof createTestDb>
type ConnectorStatus = 'healthy' | 'degraded' | 'down' | 'inactive'

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
    clientIdSecretName: `cf_access_${slug}_client_id`,
    clientSecretSecretName: `cf_access_${slug}_client_secret`,
    connectorStatus,
  })
  return id
}

async function seedSuccessfulRun(db: Db, workspaceId: string, tunnelId: string) {
  const targetId = newId('tgt')
  await db.insert(targets).values({
    id: targetId,
    workspaceId,
    name: 'API',
    slug: `api-${targetId}`,
    url: 'https://x.tunnels.test',
    method: 'GET',
    reachability: 'tunnel',
    tunnelId,
  })
  const jobId = newId('job')
  await db.insert(jobs).values({
    id: jobId,
    workspaceId,
    targetId,
    name: 'Job',
    slug: `job-${jobId}`,
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

describe('listTunnels / getTunnelBySlug', () => {
  it('reports unverified for a healthy connector with no verify and no Runs', async () => {
    const db = createTestDb()
    const workspaceId = await seedWorkspace(db)
    await seedTunnel(db, workspaceId, 'acme-hq', 'healthy')
    const [tunnel] = await listTunnels(db, workspaceId)
    expect(tunnel?.health).toBe('unverified')
  })

  it('reports operational when a recent Run against the tunnel succeeded', async () => {
    const db = createTestDb()
    const workspaceId = await seedWorkspace(db)
    const tunnelId = await seedTunnel(db, workspaceId, 'acme-hq', 'healthy')
    await seedSuccessfulRun(db, workspaceId, tunnelId)
    const [tunnel] = await listTunnels(db, workspaceId)
    expect(tunnel?.health).toBe('operational')
  })

  it('reports not_connected when the connector has never run', async () => {
    const db = createTestDb()
    const workspaceId = await seedWorkspace(db)
    await seedTunnel(db, workspaceId, 'acme-hq', null)
    const [tunnel] = await listTunnels(db, workspaceId)
    expect(tunnel?.health).toBe('not_connected')
  })

  it('getTunnelBySlug returns the tunnel and throws NotFound for an unknown slug', async () => {
    const db = createTestDb()
    const workspaceId = await seedWorkspace(db)
    await seedTunnel(db, workspaceId, 'acme-hq', 'healthy')
    await expect(getTunnelBySlug(db, workspaceId, 'acme-hq')).resolves.toMatchObject({
      slug: 'acme-hq',
    })
    await expect(getTunnelBySlug(db, workspaceId, 'nope')).rejects.toBeInstanceOf(NotFoundError)
  })
})
