import { env } from 'cloudflare:workers'
import { createServerFn } from '@tanstack/react-start'
import { eq } from 'drizzle-orm'
import { authMiddleware } from '@/lib/auth/auth-middleware'
import { createDb } from '@/lib/db/client'
import { attempts, runs } from '@/lib/db/schema'
import { z } from '@/shared/schemas/openapi'
import { RunsSearchSchema } from './filter-schema'
import { getRunDetail, listAllRuns, listRunsForJob } from './queries'

const PREVIEW_BYTES = 64 * 1024

export const listAllRunsFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator((data: unknown) => RunsSearchSchema.parse(data ?? {}))
  .handler(async ({ data }) =>
    listAllRuns(createDb(env.DB), { filters: data, cursor: data.cursor || undefined }),
  )

export const listRunsForJobFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator((data: { jobId: string; cursor?: string; limit?: number }) =>
    z
      .object({
        jobId: z.string().min(1),
        cursor: z.string().optional(),
        limit: z.int().min(1).max(100).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) =>
    listRunsForJob(createDb(env.DB), {
      jobId: data.jobId,
      ...(data.cursor ? { cursor: data.cursor } : {}),
      ...(data.limit !== undefined ? { limit: data.limit } : {}),
    }),
  )

export const getRunFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator((data: { customerSlug: string; jobSlug: string; runId: string }) =>
    z
      .object({
        customerSlug: z.string().min(1),
        jobSlug: z.string().min(1),
        runId: z.string().min(1),
      })
      .parse(data),
  )
  .handler(async ({ data }) =>
    getRunDetail(createDb(env.DB), data.customerSlug, data.jobSlug, data.runId),
  )

interface BodyPreview {
  contentType: string
  size: number
  preview: string
  truncated: boolean
  encoding: 'utf-8' | 'base64'
}

async function readPreview(bucket: R2Bucket, key: string): Promise<BodyPreview | null> {
  const obj = await bucket.get(key)
  if (!obj) return null
  const contentType = obj.httpMetadata?.contentType ?? 'application/octet-stream'
  const size = obj.size
  const truncated = size > PREVIEW_BYTES
  const buffer = truncated
    ? await (await bucket.get(key, { range: { offset: 0, length: PREVIEW_BYTES } }))?.arrayBuffer()
    : await obj.arrayBuffer()
  if (!buffer) return null
  const isText =
    contentType.startsWith('text/') ||
    contentType.includes('json') ||
    contentType.includes('xml') ||
    contentType.includes('javascript') ||
    contentType.startsWith('application/x-www-form-urlencoded')
  if (isText) {
    const text = new TextDecoder('utf-8', { fatal: false }).decode(buffer)
    return { contentType, size, preview: text, truncated, encoding: 'utf-8' }
  }
  let binary = ''
  const view = new Uint8Array(buffer)
  for (let i = 0; i < view.byteLength; i++) {
    binary += String.fromCharCode(view[i] as number)
  }
  return { contentType, size, preview: btoa(binary), truncated, encoding: 'base64' }
}

export const getAttemptBodyPreviewFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator((data: { attemptId: string; kind: 'request' | 'response' }) =>
    z
      .object({
        attemptId: z.string().min(1),
        kind: z.enum(['request', 'response']),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const db = createDb(env.DB)
    const [row] = await db
      .select({
        requestKey: attempts.requestBodyR2Key,
        responseKey: attempts.responseBodyR2Key,
        runId: attempts.runId,
      })
      .from(attempts)
      .where(eq(attempts.id, data.attemptId))
      .limit(1)
    if (!row) return null
    const key = data.kind === 'request' ? row.requestKey : row.responseKey
    if (!key) return null
    const [runRow] = await db.select({ id: runs.id }).from(runs).where(eq(runs.id, row.runId))
    if (!runRow) return null
    return readPreview(env.BODIES, key)
  })
