import { eq, inArray } from 'drizzle-orm'
import type { Database } from '@/lib/db/client'
import { attempts, customers, jobs, runs, targets, users } from '@/lib/db/schema'
import { SEED_TAG } from './constants'

export type CleanupCounts = {
  attempts: number
  runs: number
  jobs: number
  targets: number
  customers: number
  users: number
}

// D1 caps prepared-statement variables at 100; batch IN-list deletes accordingly.
const BATCH_SIZE = 90

export async function cleanupDemoData(db: Database): Promise<CleanupCounts> {
  const demoCustomers = await db
    .select({ id: customers.id })
    .from(customers)
    .where(eq(customers.seedTag, SEED_TAG))
  const customerIds = demoCustomers.map((r) => r.id)

  const counts: CleanupCounts = {
    attempts: 0,
    runs: 0,
    jobs: 0,
    targets: 0,
    customers: 0,
    users: 0,
  }

  if (customerIds.length > 0) {
    const jobRows = await db
      .select({ id: jobs.id })
      .from(jobs)
      .where(inArray(jobs.customerId, customerIds))
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
      chunked(customerIds).map((chunk) => db.delete(jobs).where(inArray(jobs.customerId, chunk))),
    )

    const targetRows = await db
      .select({ id: targets.id })
      .from(targets)
      .where(inArray(targets.customerId, customerIds))
    counts.targets = targetRows.length
    await Promise.all(
      chunked(customerIds).map((chunk) =>
        db.delete(targets).where(inArray(targets.customerId, chunk)),
      ),
    )
  }

  // channels and alert_rules cascade from customers
  await db.delete(customers).where(eq(customers.seedTag, SEED_TAG))
  counts.customers = customerIds.length

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
