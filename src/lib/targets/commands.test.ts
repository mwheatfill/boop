import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { newId } from '@/lib/db/ids'
import { jobs, tunnels } from '@/lib/db/schema'
import { createTestDb } from '@/lib/db/test-db'
import { FieldValidationError, NotFoundError } from '@/lib/errors'
import { createWorkspace } from '@/lib/workspaces/commands'
import { archiveTarget, createTarget, restoreTarget, updateTarget } from './commands'

const workspaceInput = { name: 'Acme', slug: 'acme', timezone: 'UTC' }

const targetInput = {
  name: 'Primary API',
  slug: 'primary-api',
  url: 'https://api.acme.com/healthz',
  method: 'POST' as const,
  authKind: 'none' as const,
  reachability: 'public' as const,
}

async function seedTunnel(db: ReturnType<typeof createTestDb>, workspaceId: string) {
  const id = newId('tnl')
  await db.insert(tunnels).values({
    id,
    workspaceId,
    name: 'HQ',
    slug: 'hq',
    hostname: 'hq.tunnels.test',
    cfTunnelId: 'cf',
    cfAccessAppId: 'app',
    cfAccessPolicyId: 'pol',
    cfServiceTokenId: 'st',
    clientIdSecretName: 'cid',
    clientSecretSecretName: 'csec',
  })
  return id
}

describe('createTarget', () => {
  it('inserts a target scoped to the workspace', async () => {
    const db = createTestDb()
    await createWorkspace(db, workspaceInput)
    const target = await createTarget(db, 'acme', targetInput)
    expect(target.id).toMatch(/^tgt_/)
    expect(target.workspaceId).toMatch(/^cust_/)
    expect(target.slug).toBe('primary-api')
    expect(target.status).toBe('active')
  })

  it('throws NotFoundError when the workspace slug does not exist', async () => {
    const db = createTestDb()
    await expect(createTarget(db, 'missing', targetInput)).rejects.toBeInstanceOf(NotFoundError)
  })

  it('rejects duplicate slugs within the same workspace', async () => {
    const db = createTestDb()
    await createWorkspace(db, workspaceInput)
    await createTarget(db, 'acme', targetInput)
    let thrown: unknown
    try {
      await createTarget(db, 'acme', { ...targetInput, name: 'Primary API Two' })
    } catch (err) {
      thrown = err
    }
    expect(thrown).toBeInstanceOf(FieldValidationError)
    expect((thrown as FieldValidationError).fieldErrors).toHaveProperty('slug')
  })

  it('permits the same slug under a different workspace', async () => {
    const db = createTestDb()
    await createWorkspace(db, workspaceInput)
    await createWorkspace(db, { ...workspaceInput, name: 'Beta', slug: 'beta' })
    await createTarget(db, 'acme', targetInput)
    const second = await createTarget(db, 'beta', targetInput)
    expect(second.slug).toBe('primary-api')
  })

  it('derives the url from the tunnel hostname for a tunnel target', async () => {
    const db = createTestDb()
    const workspace = await createWorkspace(db, workspaceInput)
    const tunnelId = await seedTunnel(db, workspace.id)
    const target = await createTarget(db, 'acme', {
      name: 'Internal API',
      slug: 'internal-api',
      method: 'GET',
      authKind: 'none',
      reachability: 'tunnel',
      tunnelId,
      internalOrigin: 'http://10.0.1.5:8080',
    })
    expect(target.reachability).toBe('tunnel')
    expect(target.tunnelId).toBe(tunnelId)
    expect(target.internalOrigin).toBe('http://10.0.1.5:8080')
    expect(target.url).toBe('https://internal-api.hq.tunnels.test')
  })

  it('rejects a tunnel target whose tunnel does not exist', async () => {
    const db = createTestDb()
    await createWorkspace(db, workspaceInput)
    let thrown: unknown
    try {
      await createTarget(db, 'acme', {
        name: 'Internal API',
        slug: 'internal-api',
        method: 'GET',
        authKind: 'none',
        reachability: 'tunnel',
        tunnelId: 'tnl_missing',
        internalOrigin: 'http://10.0.1.5:8080',
      })
    } catch (err) {
      thrown = err
    }
    expect(thrown).toBeInstanceOf(FieldValidationError)
    expect((thrown as FieldValidationError).fieldErrors).toHaveProperty('tunnelId')
  })

  it('rejects a tunnel target without an internal origin', async () => {
    const db = createTestDb()
    const workspace = await createWorkspace(db, workspaceInput)
    const tunnelId = await seedTunnel(db, workspace.id)
    let thrown: unknown
    try {
      await createTarget(db, 'acme', {
        name: 'Internal API',
        slug: 'internal-api',
        method: 'GET',
        authKind: 'none',
        reachability: 'tunnel',
        tunnelId,
      })
    } catch (err) {
      thrown = err
    }
    expect(thrown).toBeInstanceOf(FieldValidationError)
    expect((thrown as FieldValidationError).fieldErrors).toHaveProperty('internalOrigin')
  })
})

describe('updateTarget', () => {
  it('updates url, method, auth, and reachability fields', async () => {
    const db = createTestDb()
    await createWorkspace(db, workspaceInput)
    await createTarget(db, 'acme', targetInput)
    const updated = await updateTarget(db, 'acme', 'primary-api', {
      name: 'Renamed API',
      url: 'https://api.acme.com/v2/healthz',
      method: 'GET',
      authKind: 'bearer',
      authConfig: 'token-stub',
      reachability: 'public',
    })
    expect(updated.name).toBe('Renamed API')
    expect(updated.url).toBe('https://api.acme.com/v2/healthz')
    expect(updated.method).toBe('GET')
    expect(updated.authKind).toBe('bearer')
    expect(updated.authConfig).toBe('token-stub')
    expect(updated.reachability).toBe('public')
  })

  it('rejects tunnel reachability without a tunnel assigned', async () => {
    const db = createTestDb()
    await createWorkspace(db, workspaceInput)
    await createTarget(db, 'acme', targetInput)
    await expect(
      updateTarget(db, 'acme', 'primary-api', {
        name: 'API',
        url: 'https://api.acme.com/healthz',
        method: 'GET',
        authKind: 'none',
        authConfig: null,
        reachability: 'tunnel',
      }),
    ).rejects.toBeInstanceOf(FieldValidationError)
  })

  it('throws NotFoundError when the target slug does not exist for the workspace', async () => {
    const db = createTestDb()
    await createWorkspace(db, workspaceInput)
    await expect(
      updateTarget(db, 'acme', 'missing', {
        name: 'X',
        url: 'https://example.com',
        method: 'POST',
        authKind: 'none',
        reachability: 'public',
      }),
    ).rejects.toBeInstanceOf(NotFoundError)
  })
})

describe('archiveTarget', () => {
  it('archives a target with no jobs referencing it', async () => {
    const db = createTestDb()
    await createWorkspace(db, workspaceInput)
    await createTarget(db, 'acme', targetInput)
    const archived = await archiveTarget(db, 'acme', 'primary-api')
    expect(archived.status).toBe('archived')
  })

  it('cascade-archives the Target’s active Jobs when deleted', async () => {
    const db = createTestDb()
    const workspace = await createWorkspace(db, workspaceInput)
    const target = await createTarget(db, 'acme', targetInput)
    const jobId = newId('job')
    await db.insert(jobs).values({
      id: jobId,
      workspaceId: workspace.id,
      targetId: target.id,
      name: 'Daily',
      slug: 'daily',
      triggerKind: 'cron',
      cronExpression: '* * * * *',
      triggerTimezone: 'UTC',
      status: 'active',
    })
    const archived = await archiveTarget(db, 'acme', 'primary-api')
    expect(archived.status).toBe('archived')
    const job = (await db.select().from(jobs).where(eq(jobs.id, jobId)).limit(1))[0]
    expect(job?.status).toBe('archived')
  })
})

describe('restoreTarget', () => {
  it('restores an archived target', async () => {
    const db = createTestDb()
    await createWorkspace(db, workspaceInput)
    await createTarget(db, 'acme', targetInput)
    await archiveTarget(db, 'acme', 'primary-api')
    const restored = await restoreTarget(db, 'acme', 'primary-api')
    expect(restored.target.status).toBe('active')
  })

  it('cascade-restores the Jobs that were deleted with the Target', async () => {
    const db = createTestDb()
    const workspace = await createWorkspace(db, workspaceInput)
    const target = await createTarget(db, 'acme', targetInput)
    const jobId = newId('job')
    await db.insert(jobs).values({
      id: jobId,
      workspaceId: workspace.id,
      targetId: target.id,
      name: 'Daily',
      slug: 'daily',
      triggerKind: 'interval',
      intervalSeconds: 60,
      triggerTimezone: 'UTC',
      status: 'active',
    })
    await archiveTarget(db, 'acme', 'primary-api')
    const restored = await restoreTarget(db, 'acme', 'primary-api')
    expect(restored.rearmJobIds).toEqual([jobId])
    const job = (await db.select().from(jobs).where(eq(jobs.id, jobId)).limit(1))[0]
    expect(job?.status).toBe('active')
  })
})
