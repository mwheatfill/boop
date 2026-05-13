import { beforeEach, describe, expect, it } from 'vitest'
import { customers } from '@/lib/db/schema'
import { createTestDb } from '@/lib/db/test-db'
import {
  createSecret,
  DuplicateSecretNameError,
  fetchActiveSecretPlaintext,
  listActiveSecrets,
  revokeSecret,
  rotateSecret,
  SecretNotFoundError,
} from './commands'
import { generateKekBase64 } from './envelope'

const kek = generateKekBase64()
const fixedNow = new Date('2026-05-12T12:00:00.000Z')

async function seedCustomer(db: ReturnType<typeof createTestDb>): Promise<string> {
  const id = 'cust_test_acme'
  await db.insert(customers).values({
    id,
    name: 'Acme',
    slug: 'acme',
    timezone: 'UTC',
    createdAt: fixedNow,
    updatedAt: fixedNow,
  })
  return id
}

describe('customer secrets commands', () => {
  let db: ReturnType<typeof createTestDb>
  let customerId: string
  const deps = () => ({ db, kek, now: () => fixedNow })

  beforeEach(async () => {
    db = createTestDb()
    customerId = await seedCustomer(db)
  })

  it('creates a secret, encrypts the plaintext, and returns the plaintext once', async () => {
    const created = await createSecret(deps(), customerId, {
      name: 'stripe_api_key',
      plaintext: 'sk_live_42',
    })
    expect(created.plaintext).toBe('sk_live_42')
    expect(created.name).toBe('stripe_api_key')

    const summaries = await listActiveSecrets(deps(), customerId)
    expect(summaries).toHaveLength(1)
    expect(summaries[0]?.name).toBe('stripe_api_key')
    expect(summaries[0]).not.toHaveProperty('plaintext')
    expect(summaries[0]?.lastUsedAt).toBeNull()
  })

  it('rejects a duplicate active name', async () => {
    await createSecret(deps(), customerId, { name: 'dup', plaintext: 'one' })
    await expect(
      createSecret(deps(), customerId, { name: 'dup', plaintext: 'two' }),
    ).rejects.toBeInstanceOf(DuplicateSecretNameError)
  })

  it('rotateSecret revokes the prior row and creates a fresh one', async () => {
    await createSecret(deps(), customerId, { name: 'k', plaintext: 'old' })
    const rotated = await rotateSecret(deps(), customerId, 'k', { plaintext: 'new' })
    expect(rotated.plaintext).toBe('new')
    const active = await listActiveSecrets(deps(), customerId)
    expect(active).toHaveLength(1)
    expect(active[0]?.id).toBe(rotated.id)
  })

  it('rotateSecret throws SecretNotFoundError when no active row exists', async () => {
    await expect(
      rotateSecret(deps(), customerId, 'missing', { plaintext: 'x' }),
    ).rejects.toBeInstanceOf(SecretNotFoundError)
  })

  it('revokeSecret marks the row revoked', async () => {
    await createSecret(deps(), customerId, { name: 'r', plaintext: 'val' })
    const { revoked } = await revokeSecret(deps(), customerId, 'r')
    expect(revoked).toBe(1)
    expect(await listActiveSecrets(deps(), customerId)).toEqual([])
  })

  it('fetchActiveSecretPlaintext decrypts to the original plaintext and bumps last_used_at', async () => {
    await createSecret(deps(), customerId, { name: 's', plaintext: 'shhh' })
    const laterNow = new Date('2026-05-12T13:00:00.000Z')
    const plaintext = await fetchActiveSecretPlaintext(
      { db, kek, now: () => laterNow },
      customerId,
      's',
    )
    expect(plaintext).toBe('shhh')
    const summaries = await listActiveSecrets(deps(), customerId)
    expect(summaries[0]?.lastUsedAt).toBe(laterNow.toISOString())
  })

  it('fetchActiveSecretPlaintext throws on a revoked secret', async () => {
    await createSecret(deps(), customerId, { name: 'gone', plaintext: 'val' })
    await revokeSecret(deps(), customerId, 'gone')
    await expect(fetchActiveSecretPlaintext(deps(), customerId, 'gone')).rejects.toBeInstanceOf(
      SecretNotFoundError,
    )
  })
})
