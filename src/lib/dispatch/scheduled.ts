import { Cron } from 'croner'
import { and, eq, isNull, lte, or } from 'drizzle-orm'
import type { Database } from '@/lib/db/client'
import { createDb } from '@/lib/db/client'
import { customers, jobs } from '@/lib/db/schema'
import { logError, logInfo } from '@/lib/log'

const STALE_CLAIM_MS = 300_000

export interface DispatchMessage {
  jobId: string
  scheduledAt: Date
}

export interface ScheduledEnv {
  DB: D1Database
  DISPATCH_QUEUE: Queue<DispatchMessage>
}

export interface ScheduledDeps {
  db: Database
  dispatchQueue: Queue<DispatchMessage>
  now?: () => Date
}

async function sweepStaleClaims(db: Database, now: Date): Promise<number> {
  const cutoff = new Date(now.getTime() - STALE_CLAIM_MS)
  const swept = await db
    .update(jobs)
    .set({ fireInProgress: false, updatedAt: now })
    .where(and(eq(jobs.fireInProgress, true), lte(jobs.updatedAt, cutoff)))
    .returning({ id: jobs.id })
  return swept.length
}

interface DueRow {
  jobId: string
  cronExpression: string | null
  effectiveTz: string
  nextFireAt: Date | null
}

async function selectDueCronJobs(db: Database, now: Date): Promise<DueRow[]> {
  const rows = await db
    .select({
      jobId: jobs.id,
      cronExpression: jobs.cronExpression,
      triggerTimezone: jobs.triggerTimezone,
      customerTimezone: customers.timezone,
      nextFireAt: jobs.nextFireAt,
    })
    .from(jobs)
    .innerJoin(customers, eq(customers.id, jobs.customerId))
    .where(
      and(
        eq(jobs.status, 'active'),
        eq(jobs.triggerKind, 'cron'),
        or(isNull(jobs.nextFireAt), lte(jobs.nextFireAt, now)),
      ),
    )
  return rows.map((r) => ({
    jobId: r.jobId,
    cronExpression: r.cronExpression,
    effectiveTz: r.triggerTimezone ?? r.customerTimezone,
    nextFireAt: r.nextFireAt,
  }))
}

function nextRunFor(expression: string, timezone: string, anchor: Date): Date | null {
  try {
    return new Cron(expression, { timezone }).nextRun(anchor) ?? null
  } catch (err) {
    logError('scheduled.cron_parse_failed', err, { expression, timezone })
    return null
  }
}

export async function runScheduled({
  db,
  dispatchQueue,
  now = () => new Date(),
}: ScheduledDeps): Promise<{ swept: number; enqueued: number }> {
  const tick = now()
  const swept = await sweepStaleClaims(db, tick)
  const due = await selectDueCronJobs(db, tick)
  let enqueued = 0
  for (const row of due) {
    if (!row.cronExpression) continue
    const fireNow = row.nextFireAt !== null
    if (fireNow) {
      await dispatchQueue.send({ jobId: row.jobId, scheduledAt: tick })
      enqueued++
    }
    const next = nextRunFor(row.cronExpression, row.effectiveTz, tick)
    if (next !== null) {
      const update: Partial<typeof jobs.$inferInsert> = { nextFireAt: next, updatedAt: tick }
      if (fireNow) update.lastFireAt = tick
      await db.update(jobs).set(update).where(eq(jobs.id, row.jobId))
    }
  }
  logInfo('scheduled.tick', { swept, due: due.length, enqueued })
  return { swept, enqueued }
}

export async function scheduled(
  _controller: ScheduledController,
  env: ScheduledEnv,
  _ctx: ExecutionContext,
): Promise<void> {
  await runScheduled({ db: createDb(env.DB), dispatchQueue: env.DISPATCH_QUEUE })
}
