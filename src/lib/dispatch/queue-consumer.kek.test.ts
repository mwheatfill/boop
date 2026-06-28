import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { newId } from '@/lib/db/ids'
import { attempts, jobs, targets, tunnels, workspaces } from '@/lib/db/schema'
import { createTestDb } from '@/lib/db/test-db'
import { createSecret } from '@/lib/workspace-secrets/commands'
import { createTestR2 } from './test-r2'

// handleQueueMessage wraps env.DB with createDb; point that at the in-memory
// test DB so the queue path can be exercised end to end.
const h = vi.hoisted(() => ({ db: null as ReturnType<typeof createTestDb> | null }))
vi.mock('@/lib/db/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/db/client')>()
  return { ...actual, createDb: () => h.db }
})

const { handleQueueMessage } = await import('./queue-consumer')

const KEK = btoa('\0'.repeat(32))

async function seedTunnelJob(db: ReturnType<typeof createTestDb>) {
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
    clientIdSecretName: 'cf_access_t_client_id',
    clientSecretSecretName: 'cf_access_t_client_secret',
  })
  await createSecret({ db, kek: KEK }, workspaceId, {
    name: 'cf_access_t_client_id',
    plaintext: 'cid.access',
  })
  await createSecret({ db, kek: KEK }, workspaceId, {
    name: 'cf_access_t_client_secret',
    plaintext: 'csec',
  })
  const targetId = newId('tgt')
  await db.insert(targets).values({
    id: targetId,
    workspaceId,
    name: 'api',
    slug: 'api',
    url: 'https://api.t.tunnels.test/health',
    method: 'GET',
    reachability: 'tunnel',
    tunnelId,
    internalOrigin: 'http://10.0.0.1:8080',
  })
  const jobId = newId('job')
  await db.insert(jobs).values({
    id: jobId,
    workspaceId,
    targetId,
    name: 'j',
    slug: 'j',
    triggerKind: 'cron',
    cronExpression: '* * * * *',
  })
  return { jobId }
}

function message(jobId: string) {
  return {
    body: { jobId, scheduledAt: new Date('2026-06-28T00:00:00.000Z'), triggerSource: 'manual' },
    ack: vi.fn(),
    retry: vi.fn(),
  }
}

beforeEach(() => {
  h.db = createTestDb()
})

function db() {
  if (!h.db) throw new Error('test db not initialized')
  return h.db
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('handleQueueMessage tunnel credentials', () => {
  it('threads the KEK so a tunnel Target Run sends Access headers', async () => {
    const { jobId } = await seedTunnelJob(db())
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('ok', { status: 200 }))
    const env = {
      DB: {} as never,
      BODIES: createTestR2(),
      BOOP_SECRETS_KEK: { get: async () => KEK },
    }

    await handleQueueMessage(env as never, message(jobId) as never)

    expect(fetchSpy).toHaveBeenCalledOnce()
    const headers = new Headers((fetchSpy.mock.calls[0]?.[1] as RequestInit).headers)
    expect(headers.get('CF-Access-Client-Id')).toBe('cid.access')
    expect(headers.get('CF-Access-Client-Secret')).toBe('csec')
  })

  it('without a KEK, a tunnel Target Run fails as tunnel_credential_missing and never fetches', async () => {
    const { jobId } = await seedTunnelJob(db())
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('ok', { status: 200 }))
    const env = { DB: {} as never, BODIES: createTestR2() }

    await handleQueueMessage(env as never, message(jobId) as never)

    expect(fetchSpy).not.toHaveBeenCalled()
    const rows = await db().select().from(attempts)
    expect(rows[0]?.failureKind).toBe('tunnel_credential_missing')
  })
})
