import { and, desc, eq, gt, isNull, or } from 'drizzle-orm'
import type { Database } from '@/lib/db/client'
import { webhookSecrets } from '@/lib/db/schema'

export interface ActiveSecretRow {
  id: string
  secret: string
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
