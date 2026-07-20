import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { newId } from '@/lib/db/ids'
import { jobs, targets, webhookSecrets, workspaces } from '@/lib/db/schema'
import { createTestDb } from '@/lib/db/test-db'
import { signWebhook } from '@/lib/webhook-signing/sign'
import { verifyWebhook } from '@/lib/webhook-signing/verify'
import { generateKekBase64 } from '@/lib/workspace-secrets/envelope'
import { generateSecret } from './commands'
import { activeSecretPlaintexts, listActiveSecrets, listSecretsForJob } from './queries'

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

describe('activeSecretPlaintexts', () => {
  const kek = generateKekBase64()

  it('round-trips an encrypted secret back to plaintext that verifies an HMAC signature', async () => {
    const { db, jobId } = await seedJob()
    const { plaintext } = await generateSecret({ db, kek, now: () => NOW }, jobId)

    const keys = await activeSecretPlaintexts(db, jobId, NOW, kek)
    expect(keys).toEqual([plaintext])

    const body = '{"event":"ping"}'
    const header = await signWebhook({
      secret: plaintext,
      timestamp: Math.floor(NOW.getTime() / 1000),
      body,
    })
    const result = await verifyWebhook({ secrets: keys, header, body, now: NOW.getTime() })
    expect(result.valid).toBe(true)
  })

  it('passes a legacy plaintext row (secret_iv null) through unchanged', async () => {
    const { db, jobId } = await seedJob()
    await db.insert(webhookSecrets).values({
      id: newId('whs'),
      jobId,
      secret: 'legacy-plaintext-key',
      secretIv: null,
      createdAt: NOW,
      updatedAt: NOW,
    })
    // No KEK needed for legacy rows.
    expect(await activeSecretPlaintexts(db, jobId, NOW, undefined)).toEqual([
      'legacy-plaintext-key',
    ])
  })

  it('fails closed: skips an encrypted row when the KEK is unavailable, never returning ciphertext', async () => {
    const { db, jobId } = await seedJob()
    await generateSecret({ db, kek, now: () => NOW }, jobId)
    const [row] = await db.select().from(webhookSecrets).where(eq(webhookSecrets.jobId, jobId))
    if (!row?.secretIv) throw new Error('expected an encrypted row with secret_iv set')

    const keys = await activeSecretPlaintexts(db, jobId, NOW, undefined)
    expect(keys).toEqual([])
    expect(keys).not.toContain(row.secret)
  })

  it('fails closed: skips an encrypted row that cannot be decrypted with the given KEK, without throwing', async () => {
    const { db, jobId } = await seedJob()
    await generateSecret({ db, kek, now: () => NOW }, jobId)
    const wrongKek = generateKekBase64()
    expect(await activeSecretPlaintexts(db, jobId, NOW, wrongKek)).toEqual([])
  })
})
