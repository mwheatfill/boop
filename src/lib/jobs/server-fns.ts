import { env } from 'cloudflare:workers'
import { createServerFn } from '@tanstack/react-start'
import { authMiddleware } from '@/lib/auth/auth-middleware'
import { createDb } from '@/lib/db/client'
import { enterCronMode, enterIntervalMode, enterWebhookMode } from '@/lib/dispatch/trigger-modes'
import { asMutationFailure, type MutationResult } from '@/lib/mutation-result'
import { type Job, JobCreateInput, JobUpdateInput } from '@/shared/schemas/job'
import { z } from '@/shared/schemas/openapi'
import {
  archiveJob,
  createJob,
  type JobsDeps,
  pauseJob,
  restoreJob,
  resumeJob,
  runJobNow,
  updateJob,
} from './commands'
import { getJobDetail, listAllJobs, listJobsForCustomer, listRecentRunsForJob } from './queries'

function makeDeps(): JobsDeps {
  return {
    db: createDb(env.DB),
    dispatchQueue: env.DISPATCH_QUEUE,
    enterIntervalMode: (jobId) => enterIntervalMode(env, jobId),
    enterCronMode: (jobId) => enterCronMode(env, jobId),
    enterWebhookMode: (jobId) => enterWebhookMode(env, jobId),
  }
}

const customerOnly = z.object({ customerSlug: z.string().min(1) })
const jobSlugPair = z.object({
  customerSlug: z.string().min(1),
  jobSlug: z.string().min(1),
})

export const listAllJobsFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator(
    (data: { customerSlug?: string; status?: 'active' | 'paused' | 'archived' } | undefined) =>
      z
        .object({
          customerSlug: z.string().min(1).optional(),
          status: z.enum(['active', 'paused', 'archived']).optional(),
        })
        .parse(data ?? {}),
  )
  .handler(async ({ data }) => {
    const db = createDb(env.DB)
    if (data.customerSlug) {
      return listJobsForCustomer(db, data.customerSlug, {
        includeArchived: data.status === 'archived',
      })
    }
    return listAllJobs(db, {
      ...(data.status ? { status: data.status } : {}),
      includeArchived: data.status === 'archived',
    })
  })

export const getJobFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator((data) => jobSlugPair.parse(data))
  .handler(async ({ data }) => getJobDetail(createDb(env.DB), data.customerSlug, data.jobSlug))

export const listRecentRunsForJobFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator((data: { jobId: string; limit?: number; offset?: number }) =>
    z
      .object({
        jobId: z.string().min(1),
        limit: z.int().min(1).max(100).optional(),
        offset: z.int().min(0).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) =>
    listRecentRunsForJob(createDb(env.DB), data.jobId, {
      ...(data.limit !== undefined ? { limit: data.limit } : {}),
      ...(data.offset !== undefined ? { offset: data.offset } : {}),
    }),
  )

export const createJobFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator((data: { customerSlug: string } & z.infer<typeof JobCreateInput>) =>
    customerOnly.extend(JobCreateInput.shape).parse(data),
  )
  .handler(async ({ data }): Promise<MutationResult<Job>> => {
    const { customerSlug, ...input } = data
    try {
      const job = await createJob(makeDeps(), customerSlug, input)
      return { ok: true, data: job }
    } catch (err) {
      const failure = asMutationFailure(err)
      if (failure) return failure
      throw err
    }
  })

export const updateJobFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(
    (data: { customerSlug: string; jobSlug: string } & z.infer<typeof JobUpdateInput>) =>
      jobSlugPair.extend(JobUpdateInput.shape).parse(data),
  )
  .handler(async ({ data }): Promise<MutationResult<Job>> => {
    const { customerSlug, jobSlug, ...input } = data
    try {
      const job = await updateJob(makeDeps(), customerSlug, jobSlug, input)
      return { ok: true, data: job }
    } catch (err) {
      const failure = asMutationFailure(err)
      if (failure) return failure
      throw err
    }
  })

async function statusChange(
  action: (deps: JobsDeps, c: string, j: string) => Promise<Job>,
  data: { customerSlug: string; jobSlug: string },
): Promise<MutationResult<Job>> {
  try {
    const job = await action(makeDeps(), data.customerSlug, data.jobSlug)
    return { ok: true, data: job }
  } catch (err) {
    const failure = asMutationFailure(err)
    if (failure) return failure
    throw err
  }
}

export const pauseJobFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator((data) => jobSlugPair.parse(data))
  .handler(({ data }) => statusChange(pauseJob, data))

export const resumeJobFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator((data) => jobSlugPair.parse(data))
  .handler(({ data }) => statusChange(resumeJob, data))

export const archiveJobFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator((data) => jobSlugPair.parse(data))
  .handler(({ data }) => statusChange(archiveJob, data))

export const restoreJobFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator((data) => jobSlugPair.parse(data))
  .handler(({ data }) => statusChange(restoreJob, data))

export const runJobNowFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator((data) => jobSlugPair.parse(data))
  .handler(({ data }) => statusChange(runJobNow, data))
