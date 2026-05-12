import { describe, expect, it } from 'vitest'
import { newId } from '@/lib/db/ids'
import { customers, jobs, targets, webhookSecrets } from '@/lib/db/schema'
import { createTestDb } from '@/lib/db/test-db'
import { listActiveSecrets, listSecretsForJob } from './queries'

async function seedJob() {
  const db = createTestDb()
  const customerId = newId('cust')
  const targetId = newId('tgt')
  const jobId = newId('job')
  await db.insert(customers).values({ id: customerId, name: 'Acme', slug: 'acme', timezone: 'UTC' })
  await db.insert(targets).values({
    id: targetId,
    customerId,
    name: 'Health',
    slug: 'health',
    url: 'https://example.test',
    method: 'POST',
  })
  await db.insert(jobs).values({
    id: jobId,
    customerId,
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
    const active = await insertSecret(db, jobId, { createdAt: new Date(NOW.getTime() - 1000) })
    const future = await insertSecret(db, jobId, {
      createdAt: new Date(NOW.getTime() - 2000),
      expiresAt: new Date(NOW.getTime() + 1000),
    })
    await insertSecret(db, jobId, {
      createdAt: new Date(NOW.getTime() - 3000),
      expiresAt: new Date(NOW.getTime() - 1),
    })
    await insertSecret(db, jobId, {
      createdAt: new Date(NOW.getTime() - 4000),
      revokedAt: new Date(NOW.getTime() - 500),
    })

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
    const older = await insertSecret(db, jobId, { createdAt: new Date(NOW.getTime() - 5000) })
    const newer = await insertSecret(db, jobId, { createdAt: new Date(NOW.getTime() - 1000) })
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
    const oldRevoked = await insertSecret(db, jobId, {
      createdAt: new Date(NOW.getTime() - 4000),
      revokedAt: new Date(NOW.getTime() - 100),
    })
    const newActive = await insertSecret(db, jobId, { createdAt: new Date(NOW.getTime() - 1000) })
    const rows = await listSecretsForJob(db, jobId)
    expect(rows.map((r) => r.id)).toEqual([newActive, oldRevoked])
  })
})
