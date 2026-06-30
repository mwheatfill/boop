import { env } from 'cloudflare:workers'
import { createServerFn } from '@tanstack/react-start'
import { authMiddleware } from '@/lib/auth/auth-middleware'
import { createDb } from '@/lib/db/client'
import {
  enterCronMode,
  enterIntervalMode,
  enterManualMode,
  enterWebhookMode,
} from '@/lib/dispatch/trigger-modes'
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
import { getJobDetail, listAllJobs, listJobsForWorkspace } from './queries'

function makeDeps(): JobsDeps {
  return {
    db: createDb(env.DB),
    dispatchQueue: env.DISPATCH_QUEUE,
    enterIntervalMode: (jobId) => enterIntervalMode(env, jobId),
    enterCronMode: (jobId) => enterCronMode(env, jobId),
    enterWebhookMode: (jobId) => enterWebhookMode(env, jobId),
    enterManualMode: (jobId) => enterManualMode(env, jobId),
  }
}

const workspaceOnly = z.object({ workspaceSlug: z.string().min(1) })
const jobSlugPair = z.object({
  workspaceSlug: z.string().min(1),
  jobSlug: z.string().min(1),
})

export const listAllJobsFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator((data: { workspaceSlug?: string; includeArchived?: boolean } | undefined) =>
    z
      .object({
        workspaceSlug: z.string().min(1).optional(),
        includeArchived: z.boolean().optional(),
      })
      .parse(data ?? {}),
  )
  .handler(async ({ data }) => {
    const db = createDb(env.DB)
    const includeArchived = data.includeArchived ?? false
    if (data.workspaceSlug) {
      return listJobsForWorkspace(db, data.workspaceSlug, { includeArchived })
    }
    return listAllJobs(db, { includeArchived })
  })

export const getJobFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator((data) => jobSlugPair.parse(data))
  .handler(async ({ data }) => getJobDetail(createDb(env.DB), data.workspaceSlug, data.jobSlug))

export const createJobFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator((data: { workspaceSlug: string } & z.infer<typeof JobCreateInput>) =>
    workspaceOnly.extend(JobCreateInput.shape).parse(data),
  )
  .handler(async ({ data }): Promise<MutationResult<Job>> => {
    const { workspaceSlug, ...input } = data
    try {
      const job = await createJob(makeDeps(), workspaceSlug, input)
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
    (data: { workspaceSlug: string; jobSlug: string } & z.infer<typeof JobUpdateInput>) =>
      jobSlugPair.extend(JobUpdateInput.shape).parse(data),
  )
  .handler(async ({ data }): Promise<MutationResult<Job>> => {
    const { workspaceSlug, jobSlug, ...input } = data
    try {
      const job = await updateJob(makeDeps(), workspaceSlug, jobSlug, input)
      return { ok: true, data: job }
    } catch (err) {
      const failure = asMutationFailure(err)
      if (failure) return failure
      throw err
    }
  })

async function statusChange(
  action: (deps: JobsDeps, c: string, j: string) => Promise<Job>,
  data: { workspaceSlug: string; jobSlug: string },
): Promise<MutationResult<Job>> {
  try {
    const job = await action(makeDeps(), data.workspaceSlug, data.jobSlug)
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
