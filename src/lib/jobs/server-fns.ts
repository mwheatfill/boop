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
import { type MutationResult, runMutation } from '@/lib/mutation-result'
import { type Job, JobCreateInput, JobUpdateInput } from '@/shared/schemas/job'
import type { z } from '@/shared/schemas/openapi'
import {
  JobSlugPairInput,
  OptionalWorkspaceScopeInput,
  WorkspaceSlugInput,
} from '@/shared/schemas/resource-refs'
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

export const listAllJobsFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator((data: { workspaceSlug?: string; includeArchived?: boolean } | undefined) =>
    OptionalWorkspaceScopeInput.parse(data ?? {}),
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
  .inputValidator((data) => JobSlugPairInput.parse(data))
  .handler(async ({ data }) => getJobDetail(createDb(env.DB), data.workspaceSlug, data.jobSlug))

export const createJobFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator((data: { workspaceSlug: string } & z.infer<typeof JobCreateInput>) =>
    WorkspaceSlugInput.extend(JobCreateInput.shape).parse(data),
  )
  .handler(({ data }): Promise<MutationResult<Job>> => {
    const { workspaceSlug, ...input } = data
    return runMutation(() => createJob(makeDeps(), workspaceSlug, input))
  })

export const updateJobFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(
    (data: { workspaceSlug: string; jobSlug: string } & z.infer<typeof JobUpdateInput>) =>
      JobSlugPairInput.extend(JobUpdateInput.shape).parse(data),
  )
  .handler(({ data }): Promise<MutationResult<Job>> => {
    const { workspaceSlug, jobSlug, ...input } = data
    return runMutation(() => updateJob(makeDeps(), workspaceSlug, jobSlug, input))
  })

function statusChange(
  action: (deps: JobsDeps, c: string, j: string) => Promise<Job>,
  data: { workspaceSlug: string; jobSlug: string },
): Promise<MutationResult<Job>> {
  return runMutation(() => action(makeDeps(), data.workspaceSlug, data.jobSlug))
}

export const pauseJobFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator((data) => JobSlugPairInput.parse(data))
  .handler(({ data }) => statusChange(pauseJob, data))

export const resumeJobFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator((data) => JobSlugPairInput.parse(data))
  .handler(({ data }) => statusChange(resumeJob, data))

export const archiveJobFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator((data) => JobSlugPairInput.parse(data))
  .handler(({ data }) => statusChange(archiveJob, data))

export const restoreJobFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator((data) => JobSlugPairInput.parse(data))
  .handler(({ data }) => statusChange(restoreJob, data))

export const runJobNowFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator((data) => JobSlugPairInput.parse(data))
  .handler(({ data }) => statusChange(runJobNow, data))
