import { eq, inArray } from 'drizzle-orm'
import type { Database } from '@/lib/db/client'
import { attempts, jobs, runs, targets, users, workspaces } from '@/lib/db/schema'
import { SEED_TAG } from './constants'

export type CleanupCounts = {
  attempts: number
  runs: number
  jobs: number
  targets: number
  workspaces: number
  users: number
}

// D1 caps prepared-statement variables at 100; batch IN-list deletes accordingly.
const BATCH_SIZE = 90

export async function cleanupDemoData(db: Database): Promise<CleanupCounts> {
  const demoWorkspaces = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(eq(workspaces.seedTag, SEED_TAG))
  const workspaceIds = demoWorkspaces.map((r) => r.id)

  const counts: CleanupCounts = {
    attempts: 0,
    runs: 0,
    jobs: 0,
    targets: 0,
    workspaces: 0,
    users: 0,
  }

  if (workspaceIds.length > 0) {
    const jobRows = await db
      .select({ id: jobs.id })
      .from(jobs)
      .where(inArray(jobs.workspaceId, workspaceIds))
    const jobIds = jobRows.map((r) => r.id)

    if (jobIds.length > 0) {
      const runRows = await db.select({ id: runs.id }).from(runs).where(inArray(runs.jobId, jobIds))
      const runIds = runRows.map((r) => r.id)
      counts.runs = runIds.length

      const attemptCounts = await Promise.all(
        chunked(runIds).map(async (chunk) => {
          const attemptRows = await db
            .select({ id: attempts.id })
            .from(attempts)
            .where(inArray(attempts.runId, chunk))
          await db.delete(attempts).where(inArray(attempts.runId, chunk))
          return attemptRows.length
        }),
      )
      counts.attempts = attemptCounts.reduce((total, count) => total + count, 0)
      await Promise.all(
        chunked(jobIds).map((chunk) => db.delete(runs).where(inArray(runs.jobId, chunk))),
      )
    }
    counts.jobs = jobIds.length
    await Promise.all(
      chunked(workspaceIds).map((chunk) => db.delete(jobs).where(inArray(jobs.workspaceId, chunk))),
    )

    const targetRows = await db
      .select({ id: targets.id })
      .from(targets)
      .where(inArray(targets.workspaceId, workspaceIds))
    counts.targets = targetRows.length
    await Promise.all(
      chunked(workspaceIds).map((chunk) =>
        db.delete(targets).where(inArray(targets.workspaceId, chunk)),
      ),
    )
  }

  // channels and alert_rules cascade from workspaces
  await db.delete(workspaces).where(eq(workspaces.seedTag, SEED_TAG))
  counts.workspaces = workspaceIds.length

  const demoUsers = await db.select({ id: users.id }).from(users).where(eq(users.seedTag, SEED_TAG))
  await db.delete(users).where(eq(users.seedTag, SEED_TAG))
  counts.users = demoUsers.length

  return counts
}

function chunked<T>(items: readonly T[]): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    chunks.push(items.slice(i, i + BATCH_SIZE))
  }
  return chunks
}
