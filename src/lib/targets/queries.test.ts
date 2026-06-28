import { describe, expect, it } from 'vitest'
import { newId } from '@/lib/db/ids'
import { attempts, jobs, runs, targets, tunnels, workspaces } from '@/lib/db/schema'
import { createTestDb } from '@/lib/db/test-db'
import { getTargetBySlug, listTargetsForWorkspace } from './queries'

type Db = ReturnType<typeof createTestDb>

async function seedWorkspace(db: Db) {
  const id = newId('cust')
  await db.insert(workspaces).values({ id, name: 'Acme', slug: 'acme', timezone: 'UTC' })
  return id
}

async function seedTunnel(
  db: Db,
  workspaceId: string,
  connectorStatus: 'healthy' | 'down',
  certStatus: 'active' | 'pending',
) {
  const id = newId('tnl')
  await db.insert(tunnels).values({
    id,
    workspaceId,
    name: 'hq',
    slug: 'hq',
    hostname: 'hq.tunnels.test',
    cfTunnelId: 'cf',
    cfAccessAppId: 'app',
    cfAccessPolicyId: 'pol',
    cfServiceTokenId: 'st',
    cfCertPackId: 'cert',
    certStatus,
    clientIdSecretName: 'cid',
    clientSecretSecretName: 'csec',
    connectorStatus,
  })
  return id
}

async function seedTarget(
  db: Db,
  workspaceId: string,
  slug: string,
  opts: { reachability: 'public' | 'tunnel'; tunnelId?: string } = { reachability: 'public' },
) {
  const id = newId('tgt')
  await db.insert(targets).values({
    id,
    workspaceId,
    name: slug,
    slug,
    url: 'https://hq.tunnels.test/healthz',
    method: 'GET',
    reachability: opts.reachability,
    tunnelId: opts.tunnelId ?? null,
    internalOrigin: opts.reachability === 'tunnel' ? 'http://10.0.0.1:8080' : null,
  })
  return id
}

async function seedRun(
  db: Db,
  workspaceId: string,
  targetId: string,
  completedAt: Date,
  attempt: {
    httpStatus: number | null
    failureKind: 'http_5xx' | null
    outcome: 'success' | 'failure'
  },
) {
  const jobId = newId('job')
  await db.insert(jobs).values({
    id: jobId,
    workspaceId,
    targetId,
    name: 'j',
    slug: `j-${jobId}`,
    triggerKind: 'cron',
    cronExpression: '* * * * *',
  })
  const runId = newId('run')
  await db.insert(runs).values({
    id: runId,
    jobId,
    workspaceId,
    scheduledAt: completedAt,
    startedAt: completedAt,
    completedAt,
    status: 'completed',
    outcome: attempt.outcome,
  })
  await db.insert(attempts).values({
    id: newId('att'),
    runId,
    attemptNumber: 1,
    startedAt: completedAt,
    completedAt,
    httpStatus: attempt.httpStatus,
    failureKind: attempt.failureKind,
  })
}

describe('listTargetsForWorkspace / getTargetBySlug health', () => {
  it('leaves public Targets without a health', async () => {
    const db = createTestDb()
    const workspaceId = await seedWorkspace(db)
    await seedTarget(db, workspaceId, 'public-api')
    const [target] = await listTargetsForWorkspace(db, 'acme')
    expect(target?.health).toBeNull()
  })

  it('reports checking for an operational tunnel Target with no signal yet', async () => {
    const db = createTestDb()
    const workspaceId = await seedWorkspace(db)
    const tunnelId = await seedTunnel(db, workspaceId, 'healthy', 'active')
    await seedTarget(db, workspaceId, 'private-api', { reachability: 'tunnel', tunnelId })
    const target = await getTargetBySlug(db, 'acme', 'private-api')
    expect(target.health).toBe('checking')
  })

  it('reports tunnel_offline when the Tunnel connector is down', async () => {
    const db = createTestDb()
    const workspaceId = await seedWorkspace(db)
    const tunnelId = await seedTunnel(db, workspaceId, 'down', 'active')
    await seedTarget(db, workspaceId, 'private-api', { reachability: 'tunnel', tunnelId })
    const target = await getTargetBySlug(db, 'acme', 'private-api')
    expect(target.health).toBe('tunnel_offline')
  })

  it('reads the latest Run 502 as origin_unreachable, overriding an older success', async () => {
    const db = createTestDb()
    const workspaceId = await seedWorkspace(db)
    const tunnelId = await seedTunnel(db, workspaceId, 'healthy', 'active')
    const targetId = await seedTarget(db, workspaceId, 'private-api', {
      reachability: 'tunnel',
      tunnelId,
    })
    await seedRun(db, workspaceId, targetId, new Date('2026-06-01T00:00:00Z'), {
      httpStatus: 200,
      failureKind: null,
      outcome: 'success',
    })
    await seedRun(db, workspaceId, targetId, new Date('2026-06-02T00:00:00Z'), {
      httpStatus: 502,
      failureKind: 'http_5xx',
      outcome: 'failure',
    })
    const target = await getTargetBySlug(db, 'acme', 'private-api')
    expect(target.health).toBe('origin_unreachable')
  })
})
