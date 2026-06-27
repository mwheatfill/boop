import { describe, expect, it } from 'vitest'
import { newId } from '@/lib/db/ids'
import { jobs, targets, webhookSecrets, workspaces } from '@/lib/db/schema'
import { createTestDb } from '@/lib/db/test-db'
import { listActiveSecrets, listSecretsForJob } from './queries'

async function seedJob() {
  const db = createTestDb()
  const workspaceId = newId('cust')
  const targetId = newId('tgt')
  const jobId = newId('job')
  await db
    .insert(workspaces)
    .values({ id: workspaceId, name: 'Acme', slug: 'acme', timezone: 'UTC' })
  await db.insert(targets).values({
    id: targetId,
    workspaceId,
    name: 'Health',
    slug: 'health',
    url: 'https://example.test',
    method: 'POST',
  })
  await db.insert(jobs).values({
    id: jobId,
    workspaceId,
    targetId,
    name: 'Hook',
    slug: 'hook',
    triggerKind: 'webhook',
  })
  return { db, jobId }
}

async function insertSecret(
  db: Awaited<ReturnType<typeof seedJob>>['db'],
  jobId: string,
  fields: { createdAt: Date; expiresAt?: Date | null; revokedAt?: Date | null },
) {
  const id = newId('whs')
  await db.insert(webhookSecrets).values({
    id,
    jobId,
    secret: id,
    createdAt: fields.createdAt,
    updatedAt: fields.createdAt,
    expiresAt: fields.expiresAt ?? null,
    revokedAt: fields.revokedAt ?? null,
  })
  return id
}

const NOW = new Date('2026-05-12T12:00:00.000Z')

describe('listActiveSecrets', () => {
  it('returns rows with revoked_at IS NULL and (expires_at IS NULL OR expires_at > now)', async () => {
    const { db, jobId } = await seedJob()
    const [active, future] = await Promise.all([
      insertSecret(db, jobId, { createdAt: new Date(NOW.getTime() - 1000) }),
      insertSecret(db, jobId, {
        createdAt: new Date(NOW.getTime() - 2000),
        expiresAt: new Date(NOW.getTime() + 1000),
      }),
      insertSecret(db, jobId, {
        createdAt: new Date(NOW.getTime() - 3000),
        expiresAt: new Date(NOW.getTime() - 1),
      }),
      insertSecret(db, jobId, {
        createdAt: new Date(NOW.getTime() - 4000),
        revokedAt: new Date(NOW.getTime() - 500),
      }),
    ])

    const rows = await listActiveSecrets(db, jobId, NOW)
    expect(rows.map((r) => r.id)).toEqual([active, future])
  })

  it('excludes rows where expires_at === now (boundary)', async () => {
    const { db, jobId } = await seedJob()
    await insertSecret(db, jobId, { createdAt: NOW, expiresAt: NOW })
    expect(await listActiveSecrets(db, jobId, NOW)).toEqual([])
  })

  it('sorts results by created_at DESC', async () => {
    const { db, jobId } = await seedJob()
    const [older, newer] = await Promise.all([
      insertSecret(db, jobId, { createdAt: new Date(NOW.getTime() - 5000) }),
      insertSecret(db, jobId, { createdAt: new Date(NOW.getTime() - 1000) }),
    ])
    const rows = await listActiveSecrets(db, jobId, NOW)
    expect(rows.map((r) => r.id)).toEqual([newer, older])
  })

  it('returns an empty list when the Job has no secrets', async () => {
    const { db, jobId } = await seedJob()
    expect(await listActiveSecrets(db, jobId, NOW)).toEqual([])
  })
})

describe('listSecretsForJob', () => {
  it('returns every secret including revoked and expired ones, newest first', async () => {
    const { db, jobId } = await seedJob()
    const [oldRevoked, newActive] = await Promise.all([
      insertSecret(db, jobId, {
        createdAt: new Date(NOW.getTime() - 4000),
        revokedAt: new Date(NOW.getTime() - 100),
      }),
      insertSecret(db, jobId, { createdAt: new Date(NOW.getTime() - 1000) }),
    ])
    const rows = await listSecretsForJob(db, jobId)
    expect(rows.map((r) => r.id)).toEqual([newActive, oldRevoked])
  })
})
