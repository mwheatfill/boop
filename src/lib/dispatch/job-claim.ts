import { and, eq, sql } from 'drizzle-orm'
import type { Database } from '@/lib/db/client'
import { jobs } from '@/lib/db/schema'

// Floor a wedged claim must exceed before the reaper releases it. Even a Job
// with a tiny deadline holds its lease at least this long, so the reaper never
// races a still-running short dispatch.
export const STALE_CLAIM_FLOOR_MS = 300_000

// Buffer added to a Job's own dispatch deadline before its lease counts as
// wedged, covering queue latency and the release write that lands just after
// the deadline elapses.
export const STALE_CLAIM_MARGIN_MS = 60_000

// Acquires the lease via a D1 row-level compare-and-set over jobs.fireInProgress
// (ADR-014). Returns the jobId when this caller won the claim, or null when
// another dispatch already holds it, so duplicate Queue deliveries no-op.
export async function claim(db: Database, jobId: string): Promise<string | null> {
  const claimed = await db
    .update(jobs)
    .set({ fireInProgress: true, updatedAt: new Date() })
    .where(and(eq(jobs.id, jobId), eq(jobs.fireInProgress, false)))
    .returning({ id: jobs.id })
  return claimed[0]?.id ?? null
}

// Releases the lease so the next dispatch can claim the Job.
export async function release(db: Database, jobId: string): Promise<void> {
  await db
    .update(jobs)
    .set({ fireInProgress: false, updatedAt: new Date() })
    .where(eq(jobs.id, jobId))
}

// Reaps wedged claims in one bulk conditional UPDATE, returning how many leases
// it released. A lease is stale only once it has been held longer than
// max(STALE_CLAIM_FLOOR_MS, overallDeadlineMs + STALE_CLAIM_MARGIN_MS): a
// long-deadline Job is never reaped before its own dispatch deadline could have
// elapsed, while short-deadline Jobs keep the floor. For the default 60s
// deadline the effective TTL stays the 5-minute floor. jobs.updatedAt (set at
// claim time) is the held-since marker; the per-row TTL is expressed via
// SQLite's scalar max() with bound parameters.
export async function reapStale(db: Database, now: Date): Promise<number> {
  const swept = await db
    .update(jobs)
    .set({ fireInProgress: false, updatedAt: now })
    .where(
      and(
        eq(jobs.fireInProgress, true),
        sql`${jobs.updatedAt} <= ${now.getTime()} - max(${STALE_CLAIM_FLOOR_MS}, ${jobs.overallDeadlineMs} + ${STALE_CLAIM_MARGIN_MS})`,
      ),
    )
    .returning({ id: jobs.id })
  return swept.length
}
