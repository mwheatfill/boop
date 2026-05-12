import { and, eq, isNull } from 'drizzle-orm'
import type { Database } from '@/lib/db/client'
import { newId } from '@/lib/db/ids'
import { webhookSecrets } from '@/lib/db/schema'
import { generateSecretValue } from './random'

export interface GeneratedSecret {
  id: string
  plaintext: string
  createdAt: Date
}

export interface WebhookSecretsDeps {
  db: Database
  now?: () => Date
}

export async function generateSecret(
  { db, now = () => new Date() }: WebhookSecretsDeps,
  jobId: string,
): Promise<GeneratedSecret> {
  const id = newId('whs')
  const plaintext = generateSecretValue()
  const createdAt = now()
  await db.insert(webhookSecrets).values({
    id,
    jobId,
    secret: plaintext,
    createdAt,
    updatedAt: createdAt,
  })
  return { id, plaintext, createdAt }
}

const HOUR_MS = 3_600_000
const MIN_OVERLAP_HOURS = 1
const MAX_OVERLAP_HOURS = 168

export class InvalidOverlapError extends Error {
  constructor(overlapHours: number) {
    super(`overlapHours must be between ${MIN_OVERLAP_HOURS} and ${MAX_OVERLAP_HOURS}`)
    this.name = 'InvalidOverlapError'
    this.overlapHours = overlapHours
  }
  readonly overlapHours: number
}

export interface RotateInput {
  overlapHours: number
}

export async function rotateSecret(
  deps: WebhookSecretsDeps,
  jobId: string,
  { overlapHours }: RotateInput,
): Promise<GeneratedSecret> {
  if (
    !Number.isFinite(overlapHours) ||
    overlapHours < MIN_OVERLAP_HOURS ||
    overlapHours > MAX_OVERLAP_HOURS
  ) {
    throw new InvalidOverlapError(overlapHours)
  }
  const { db, now = () => new Date() } = deps
  const rotateAt = now()
  const expiresAt = new Date(rotateAt.getTime() + overlapHours * HOUR_MS)
  await db
    .update(webhookSecrets)
    .set({ expiresAt, updatedAt: rotateAt })
    .where(
      and(
        eq(webhookSecrets.jobId, jobId),
        isNull(webhookSecrets.revokedAt),
        isNull(webhookSecrets.expiresAt),
      ),
    )
  return generateSecret({ db, now: () => rotateAt }, jobId)
}

export async function revokeAllSecrets(
  { db, now = () => new Date() }: WebhookSecretsDeps,
  jobId: string,
): Promise<{ revoked: number }> {
  const revokedAt = now()
  const updated = await db
    .update(webhookSecrets)
    .set({ revokedAt, updatedAt: revokedAt })
    .where(and(eq(webhookSecrets.jobId, jobId), isNull(webhookSecrets.revokedAt)))
    .returning({ id: webhookSecrets.id })
  return { revoked: updated.length }
}
