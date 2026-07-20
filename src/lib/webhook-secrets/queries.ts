import { and, desc, eq, gt, isNull, or } from 'drizzle-orm'
import type { Database } from '@/lib/db/client'
import { webhookSecrets } from '@/lib/db/schema'
import { decryptSecret } from '@/lib/workspace-secrets/envelope'

export interface ActiveSecretRow {
  id: string
  secret: string
  secretIv: string | null
  createdAt: Date
  expiresAt: Date | null
}

export async function listActiveSecrets(
  db: Database,
  jobId: string,
  now: Date,
): Promise<ActiveSecretRow[]> {
  return db
    .select({
      id: webhookSecrets.id,
      secret: webhookSecrets.secret,
      secretIv: webhookSecrets.secretIv,
      createdAt: webhookSecrets.createdAt,
      expiresAt: webhookSecrets.expiresAt,
    })
    .from(webhookSecrets)
    .where(
      and(
        eq(webhookSecrets.jobId, jobId),
        isNull(webhookSecrets.revokedAt),
        or(isNull(webhookSecrets.expiresAt), gt(webhookSecrets.expiresAt, now)),
      ),
    )
    .orderBy(desc(webhookSecrets.createdAt))
}

/**
 * Active secrets as usable HMAC keys. Encrypted rows (secret_iv present) are
 * decrypted with the KEK; if the KEK is unavailable such rows are skipped
 * (fail closed) so ciphertext is never used as a signing key. Legacy rows
 * (secret_iv null) hold plaintext and pass through unchanged.
 */
export async function activeSecretPlaintexts(
  db: Database,
  jobId: string,
  now: Date,
  kek: string | undefined,
): Promise<string[]> {
  const rows = await listActiveSecrets(db, jobId, now)
  const plaintexts: string[] = []
  for (const row of rows) {
    if (row.secretIv !== null) {
      if (kek === undefined) continue
      plaintexts.push(await decryptSecret(row.secret, row.secretIv, kek))
    } else {
      plaintexts.push(row.secret)
    }
  }
  return plaintexts
}

export interface SecretSummary {
  id: string
  createdAt: Date
  expiresAt: Date | null
  revokedAt: Date | null
}

export async function listSecretsForJob(db: Database, jobId: string): Promise<SecretSummary[]> {
  return db
    .select({
      id: webhookSecrets.id,
      createdAt: webhookSecrets.createdAt,
      expiresAt: webhookSecrets.expiresAt,
      revokedAt: webhookSecrets.revokedAt,
    })
    .from(webhookSecrets)
    .where(eq(webhookSecrets.jobId, jobId))
    .orderBy(desc(webhookSecrets.createdAt))
}
