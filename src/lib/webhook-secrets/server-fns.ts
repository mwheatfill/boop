import { env } from 'cloudflare:workers'
import { createServerFn } from '@tanstack/react-start'
import { and, eq } from 'drizzle-orm'
import { authMiddleware } from '@/lib/auth/auth-middleware'
import { createDb } from '@/lib/db/client'
import { jobs, workspaces } from '@/lib/db/schema'
import { NotFoundError } from '@/lib/errors'
import { z } from '@/shared/schemas/openapi'
import { RotateInputSchema } from '@/shared/schemas/webhook-secret'
import {
  generateSecret as generateSecretCmd,
  revokeAllSecrets as revokeAllSecretsCmd,
  rotateSecret as rotateSecretCmd,
} from './commands'
import { listSecretsForJob } from './queries'

const jobSlugPair = z.object({
  workspaceSlug: z.string().min(1),
  jobSlug: z.string().min(1),
})

async function resolveJobId(
  db: ReturnType<typeof createDb>,
  workspaceSlug: string,
  jobSlug: string,
): Promise<string> {
  const [row] = await db
    .select({ id: jobs.id })
    .from(jobs)
    .innerJoin(workspaces, eq(workspaces.id, jobs.workspaceId))
    .where(and(eq(workspaces.slug, workspaceSlug), eq(jobs.slug, jobSlug)))
    .limit(1)
  if (!row) throw new NotFoundError('Job', `${workspaceSlug}/${jobSlug}`)
  return row.id
}

function toSummary(row: Awaited<ReturnType<typeof listSecretsForJob>>[number]) {
  return {
    id: row.id,
    createdAt: row.createdAt.toISOString(),
    expiresAt: row.expiresAt?.toISOString() ?? null,
    revokedAt: row.revokedAt?.toISOString() ?? null,
  }
}

export const listWebhookSecretsFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator((data) => jobSlugPair.parse(data))
  .handler(async ({ data }) => {
    const db = createDb(env.DB)
    const jobId = await resolveJobId(db, data.workspaceSlug, data.jobSlug)
    const rows = await listSecretsForJob(db, jobId)
    return { secrets: rows.map(toSummary) }
  })

export const generateWebhookSecretFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator((data) => jobSlugPair.parse(data))
  .handler(async ({ data }) => {
    const db = createDb(env.DB)
    const jobId = await resolveJobId(db, data.workspaceSlug, data.jobSlug)
    const created = await generateSecretCmd({ db }, jobId)
    return {
      id: created.id,
      plaintext: created.plaintext,
      createdAt: created.createdAt.toISOString(),
    }
  })

export const rotateWebhookSecretFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator((data: { workspaceSlug: string; jobSlug: string; overlapHours?: number }) =>
    jobSlugPair.extend(RotateInputSchema.shape).parse(data),
  )
  .handler(async ({ data }) => {
    const db = createDb(env.DB)
    const jobId = await resolveJobId(db, data.workspaceSlug, data.jobSlug)
    const created = await rotateSecretCmd({ db }, jobId, { overlapHours: data.overlapHours })
    return {
      id: created.id,
      plaintext: created.plaintext,
      createdAt: created.createdAt.toISOString(),
    }
  })

export const revokeWebhookSecretsFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator((data) => jobSlugPair.parse(data))
  .handler(async ({ data }) => {
    const db = createDb(env.DB)
    const jobId = await resolveJobId(db, data.workspaceSlug, data.jobSlug)
    return revokeAllSecretsCmd({ db }, jobId)
  })
