import { and, eq, isNull } from 'drizzle-orm'
import type { Database } from '@/lib/db/client'
import { newId } from '@/lib/db/ids'
import { workspaceSecrets } from '@/lib/db/schema'
import type { SecretRevealedResponse, SecretSummary } from '@/shared/schemas/workspace-secret'
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

export interface WorkspaceSecretsReadDeps {
  db: Database
  now?: () => Date
}

export interface WorkspaceSecretsDeps extends WorkspaceSecretsReadDeps {
  kek: string
}

const LAST_USED_AT_REFRESH_MS = 60_000

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
  deps: WorkspaceSecretsReadDeps,
  workspaceId: string,
): Promise<SecretSummary[]> {
  const rows = await deps.db
    .select({
      id: workspaceSecrets.id,
      name: workspaceSecrets.name,
      createdAt: workspaceSecrets.createdAt,
      lastUsedAt: workspaceSecrets.lastUsedAt,
      revokedAt: workspaceSecrets.revokedAt,
    })
    .from(workspaceSecrets)
    .where(and(eq(workspaceSecrets.workspaceId, workspaceId), isNull(workspaceSecrets.revokedAt)))
    .orderBy(workspaceSecrets.name)
  return rows.map(toSummary)
}

export async function createSecret(
  deps: WorkspaceSecretsDeps,
  workspaceId: string,
  input: { name: string; plaintext: string },
): Promise<SecretRevealedResponse> {
  const { db, kek, now = () => new Date() } = deps
  const existing = await db
    .select({ id: workspaceSecrets.id })
    .from(workspaceSecrets)
    .where(
      and(
        eq(workspaceSecrets.workspaceId, workspaceId),
        eq(workspaceSecrets.name, input.name),
        isNull(workspaceSecrets.revokedAt),
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
  await db.insert(workspaceSecrets).values({
    id,
    workspaceId,
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
  deps: WorkspaceSecretsDeps,
  workspaceId: string,
  secretName: string,
  input: { plaintext: string },
): Promise<SecretRevealedResponse> {
  const { db, kek, now = () => new Date() } = deps
  const rotateAt = now()
  const revoked = await db
    .update(workspaceSecrets)
    .set({ revokedAt: rotateAt, updatedAt: rotateAt })
    .where(
      and(
        eq(workspaceSecrets.workspaceId, workspaceId),
        eq(workspaceSecrets.name, secretName),
        isNull(workspaceSecrets.revokedAt),
      ),
    )
    .returning({ id: workspaceSecrets.id })
  if (revoked.length === 0) throw new SecretNotFoundError(secretName)
  return createSecret({ db, kek, now: () => rotateAt }, workspaceId, {
    name: secretName,
    plaintext: input.plaintext,
  })
}

export async function revokeSecret(
  deps: WorkspaceSecretsReadDeps,
  workspaceId: string,
  secretName: string,
): Promise<{ revoked: number }> {
  const { db, now = () => new Date() } = deps
  const revokedAt = now()
  const updated = await db
    .update(workspaceSecrets)
    .set({ revokedAt, updatedAt: revokedAt })
    .where(
      and(
        eq(workspaceSecrets.workspaceId, workspaceId),
        eq(workspaceSecrets.name, secretName),
        isNull(workspaceSecrets.revokedAt),
      ),
    )
    .returning({ id: workspaceSecrets.id })
  return { revoked: updated.length }
}

export async function fetchActiveSecretPlaintext(
  deps: WorkspaceSecretsDeps,
  workspaceId: string,
  secretName: string,
): Promise<string> {
  const { db, kek, now = () => new Date() } = deps
  const rows = await db
    .select({
      id: workspaceSecrets.id,
      ciphertext: workspaceSecrets.valueCiphertext,
      iv: workspaceSecrets.valueIv,
      lastUsedAt: workspaceSecrets.lastUsedAt,
    })
    .from(workspaceSecrets)
    .where(
      and(
        eq(workspaceSecrets.workspaceId, workspaceId),
        eq(workspaceSecrets.name, secretName),
        isNull(workspaceSecrets.revokedAt),
      ),
    )
    .limit(1)
  const row = rows[0]
  if (!row) throw new SecretNotFoundError(secretName)
  const plaintext = await decryptSecret(row.ciphertext, row.iv, kek)
  const usedAt = now()
  const lastUsedFresh =
    row.lastUsedAt !== null && usedAt.getTime() - row.lastUsedAt.getTime() < LAST_USED_AT_REFRESH_MS
  if (!lastUsedFresh) {
    await db
      .update(workspaceSecrets)
      .set({ lastUsedAt: usedAt, updatedAt: usedAt })
      .where(eq(workspaceSecrets.id, row.id))
  }
  return plaintext
}
