import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { newId } from '@/lib/db/ids'
import { customers, jobs, targets, webhookSecrets } from '@/lib/db/schema'
import { createTestDb } from '@/lib/db/test-db'
import { generateSecret, InvalidOverlapError, revokeAllSecrets, rotateSecret } from './commands'
import { listActiveSecrets } from './queries'

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

const FIXED = new Date('2026-05-12T12:00:00.000Z')

describe('generateSecret', () => {
  it('writes one row whose secret column equals the returned plaintext (32 random bytes, hex)', async () => {
    const { db, jobId } = await seedJob()
    const result = await generateSecret({ db, now: () => FIXED }, jobId)
    expect(result.plaintext).toMatch(/^[0-9a-f]{64}$/)
    expect(result.id).toMatch(/^whs_/)
    expect(result.createdAt).toEqual(FIXED)
    const [row] = await db.select().from(webhookSecrets).where(eq(webhookSecrets.jobId, jobId))
    expect(row?.secret).toBe(result.plaintext)
  })

  it('produces a fresh plaintext on every call', async () => {
    const { db, jobId } = await seedJob()
    const first = await generateSecret({ db, now: () => FIXED }, jobId)
    const second = await generateSecret({ db, now: () => new Date(FIXED.getTime() + 1) }, jobId)
    expect(first.plaintext).not.toBe(second.plaintext)
  })
})

describe('rotateSecret', () => {
  it('writes a new active secret and sets expires_at on every previously-active secret', async () => {
    const { db, jobId } = await seedJob()
    const first = await generateSecret({ db, now: () => FIXED }, jobId)
    const rotateAt = new Date(FIXED.getTime() + 60_000)
    const second = await rotateSecret({ db, now: () => rotateAt }, jobId, { overlapHours: 24 })
    expect(second.id).not.toBe(first.id)

    const firstRow = (
      await db.select().from(webhookSecrets).where(eq(webhookSecrets.id, first.id))
    )[0]
    expect(firstRow?.expiresAt?.getTime()).toBe(rotateAt.getTime() + 24 * 3_600_000)

    const secondRow = (
      await db.select().from(webhookSecrets).where(eq(webhookSecrets.id, second.id))
    )[0]
    expect(secondRow?.expiresAt).toBeNull()
    expect(secondRow?.revokedAt).toBeNull()
  })

  it('does not touch secrets that already have an expires_at (mid-rotation)', async () => {
    const { db, jobId } = await seedJob()
    await generateSecret({ db, now: () => FIXED }, jobId)
    const firstRotateAt = new Date(FIXED.getTime() + 60_000)
    await rotateSecret({ db, now: () => firstRotateAt }, jobId, { overlapHours: 24 })

    const secondRotateAt = new Date(firstRotateAt.getTime() + 60_000)
    await rotateSecret({ db, now: () => secondRotateAt }, jobId, { overlapHours: 12 })

    const rows = await db.select().from(webhookSecrets).where(eq(webhookSecrets.jobId, jobId))
    expect(rows).toHaveLength(3)
    const expiries = rows.flatMap((r) => (r.expiresAt ? [r.expiresAt.getTime()] : []))
    expect(expiries).toContain(firstRotateAt.getTime() + 24 * 3_600_000)
    expect(expiries).toContain(secondRotateAt.getTime() + 12 * 3_600_000)
  })

  it.each([0, -1, 169, Number.NaN])('rejects overlapHours = %s', async (overlap) => {
    const { db, jobId } = await seedJob()
    await expect(rotateSecret({ db }, jobId, { overlapHours: overlap })).rejects.toBeInstanceOf(
      InvalidOverlapError,
    )
  })

  it('still creates a fresh secret when no prior active secrets exist', async () => {
    const { db, jobId } = await seedJob()
    const created = await rotateSecret({ db, now: () => FIXED }, jobId, { overlapHours: 24 })
    expect(created.plaintext).toMatch(/^[0-9a-f]{64}$/)
    const active = await listActiveSecrets(db, jobId, FIXED)
    expect(active.map((r) => r.id)).toEqual([created.id])
  })
})

describe('revokeAllSecrets', () => {
  it('sets revoked_at on every non-revoked row', async () => {
    const { db, jobId } = await seedJob()
    await generateSecret({ db, now: () => FIXED }, jobId)
    await generateSecret({ db, now: () => new Date(FIXED.getTime() + 1000) }, jobId)
    const revokeAt = new Date(FIXED.getTime() + 60_000)
    const { revoked } = await revokeAllSecrets({ db, now: () => revokeAt }, jobId)
    expect(revoked).toBe(2)
    const rows = await db.select().from(webhookSecrets).where(eq(webhookSecrets.jobId, jobId))
    for (const row of rows) {
      expect(row.revokedAt?.getTime()).toBe(revokeAt.getTime())
    }
  })

  it('leaves already-revoked rows untouched', async () => {
    const { db, jobId } = await seedJob()
    const { id: revokedId } = await generateSecret({ db, now: () => FIXED }, jobId)
    const firstRevoke = new Date(FIXED.getTime() + 1000)
    await revokeAllSecrets({ db, now: () => firstRevoke }, jobId)

    await generateSecret({ db, now: () => new Date(FIXED.getTime() + 2000) }, jobId)
    const secondRevoke = new Date(FIXED.getTime() + 3000)
    await revokeAllSecrets({ db, now: () => secondRevoke }, jobId)

    const [revokedRow] = await db
      .select()
      .from(webhookSecrets)
      .where(eq(webhookSecrets.id, revokedId))
    expect(revokedRow?.revokedAt?.getTime()).toBe(firstRevoke.getTime())
  })

  it('produces an active secret on generateSecret after revokeAllSecrets', async () => {
    const { db, jobId } = await seedJob()
    await generateSecret({ db, now: () => FIXED }, jobId)
    await revokeAllSecrets({ db, now: () => new Date(FIXED.getTime() + 1000) }, jobId)
    const fresh = await generateSecret({ db, now: () => new Date(FIXED.getTime() + 2000) }, jobId)
    const active = await listActiveSecrets(db, jobId, new Date(FIXED.getTime() + 3000))
    expect(active.map((r) => r.id)).toEqual([fresh.id])
  })
})
