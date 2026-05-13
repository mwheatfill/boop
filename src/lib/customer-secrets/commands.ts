import { and, eq, isNull } from 'drizzle-orm'
import type { Database } from '@/lib/db/client'
import { newId } from '@/lib/db/ids'
import { customerSecrets } from '@/lib/db/schema'
import type { SecretRevealedResponse, SecretSummary } from '@/shared/schemas/customer-secret'
import { decryptSecret, encryptSecret, hashSecretValue } from './envelope'

export class SecretNotFoundError extends Error {
  readonly secretName: string
  constructor(secretName: string) {
    super(`Secret not found: ${secretName}`)
    this.name = 'SecretNotFoundError'
    this.secretName = secretName
  }
}

export class DuplicateSecretNameError extends Error {
  readonly secretName: string
  constructor(secretName: string) {
    super(`A secret named "${secretName}" is already active`)
    this.name = 'DuplicateSecretNameError'
    this.secretName = secretName
  }
}

export interface CustomerSecretsDeps {
  db: Database
  kek: string
  now?: () => Date
}

function toSummary(row: {
  id: string
  name: string
  createdAt: Date
  lastUsedAt: Date | null
  revokedAt: Date | null
}): SecretSummary {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.createdAt.toISOString(),
    lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
    revokedAt: row.revokedAt?.toISOString() ?? null,
  }
}

export async function listActiveSecrets(
  deps: CustomerSecretsDeps,
  customerId: string,
): Promise<SecretSummary[]> {
  const rows = await deps.db
    .select({
      id: customerSecrets.id,
      name: customerSecrets.name,
      createdAt: customerSecrets.createdAt,
      lastUsedAt: customerSecrets.lastUsedAt,
      revokedAt: customerSecrets.revokedAt,
    })
    .from(customerSecrets)
    .where(and(eq(customerSecrets.customerId, customerId), isNull(customerSecrets.revokedAt)))
    .orderBy(customerSecrets.name)
  return rows.map(toSummary)
}

export async function createSecret(
  deps: CustomerSecretsDeps,
  customerId: string,
  input: { name: string; plaintext: string },
): Promise<SecretRevealedResponse> {
  const { db, kek, now = () => new Date() } = deps
  const existing = await db
    .select({ id: customerSecrets.id })
    .from(customerSecrets)
    .where(
      and(
        eq(customerSecrets.customerId, customerId),
        eq(customerSecrets.name, input.name),
        isNull(customerSecrets.revokedAt),
      ),
    )
    .limit(1)
  if (existing.length > 0) throw new DuplicateSecretNameError(input.name)

  const id = newId('csec')
  const createdAt = now()
  const [{ ciphertext, iv }, hash] = await Promise.all([
    encryptSecret(input.plaintext, kek),
    hashSecretValue(input.plaintext),
  ])
  await db.insert(customerSecrets).values({
    id,
    customerId,
    name: input.name,
    valueHash: hash,
    valueCiphertext: ciphertext,
    valueIv: iv,
    createdAt,
    updatedAt: createdAt,
  })
  return { id, name: input.name, plaintext: input.plaintext, createdAt: createdAt.toISOString() }
}

export async function rotateSecret(
  deps: CustomerSecretsDeps,
  customerId: string,
  secretName: string,
  input: { plaintext: string },
): Promise<SecretRevealedResponse> {
  const { db, kek, now = () => new Date() } = deps
  const rotateAt = now()
  const revoked = await db
    .update(customerSecrets)
    .set({ revokedAt: rotateAt, updatedAt: rotateAt })
    .where(
      and(
        eq(customerSecrets.customerId, customerId),
        eq(customerSecrets.name, secretName),
        isNull(customerSecrets.revokedAt),
      ),
    )
    .returning({ id: customerSecrets.id })
  if (revoked.length === 0) throw new SecretNotFoundError(secretName)
  return createSecret({ db, kek, now: () => rotateAt }, customerId, {
    name: secretName,
    plaintext: input.plaintext,
  })
}

export async function revokeSecret(
  deps: CustomerSecretsDeps,
  customerId: string,
  secretName: string,
): Promise<{ revoked: number }> {
  const { db, now = () => new Date() } = deps
  const revokedAt = now()
  const updated = await db
    .update(customerSecrets)
    .set({ revokedAt, updatedAt: revokedAt })
    .where(
      and(
        eq(customerSecrets.customerId, customerId),
        eq(customerSecrets.name, secretName),
        isNull(customerSecrets.revokedAt),
      ),
    )
    .returning({ id: customerSecrets.id })
  return { revoked: updated.length }
}

export async function fetchActiveSecretPlaintext(
  deps: CustomerSecretsDeps,
  customerId: string,
  secretName: string,
): Promise<string> {
  const { db, kek, now = () => new Date() } = deps
  const rows = await db
    .select({
      id: customerSecrets.id,
      ciphertext: customerSecrets.valueCiphertext,
      iv: customerSecrets.valueIv,
    })
    .from(customerSecrets)
    .where(
      and(
        eq(customerSecrets.customerId, customerId),
        eq(customerSecrets.name, secretName),
        isNull(customerSecrets.revokedAt),
      ),
    )
    .limit(1)
  const row = rows[0]
  if (!row) throw new SecretNotFoundError(secretName)
  const plaintext = await decryptSecret(row.ciphertext, row.iv, kek)
  const usedAt = now()
  await db
    .update(customerSecrets)
    .set({ lastUsedAt: usedAt, updatedAt: usedAt })
    .where(eq(customerSecrets.id, row.id))
  return plaintext
}
