import { Cron } from 'croner'
import { and, count, desc, eq, gte, inArray, sql } from 'drizzle-orm'
import type { Database } from '@/lib/db/client'
import { customers, jobs, runs } from '@/lib/db/schema'
import type {
  DashboardSummary,
  NeedsAttentionRow,
  RecentFailureRow,
  RunsDailyBucket,
  Sparklines,
  Stats,
  UpcomingFireRow,
} from '@/shared/schemas/dashboard'

const HOUR_MS = 3_600_000
const DAY_MS = 86_400_000
const UPCOMING_FIRES_CAP = 500
const UPCOMING_FIRES_LIMIT = 10
const NEEDS_ATTENTION_LIMIT = 20
const RECENT_FAILURES_LIMIT = 10

export async function dashboardSummary(db: Database, now = new Date()): Promise<DashboardSummary> {
  const [stats, sparklines, runsSeries7d, needsAttention, upcomingFires, recentFailures] =
    await Promise.all([
      computeStats(db, now),
      computeSparklines(db, now),
      computeRunsSeries7d(db, now),
      computeNeedsAttention(db, now),
      computeUpcomingFires(db, now),
      computeRecentFailures(db),
    ])

  return { stats, sparklines, runsSeries7d, needsAttention, upcomingFires, recentFailures }
}

async function computeStats(db: Database, now: Date): Promise<Stats> {
  const dayAgo = new Date(now.getTime() - DAY_MS)
  const sevenDaysAgo = new Date(now.getTime() - 7 * DAY_MS)

  const [activeRow] = await db.select({ n: count() }).from(jobs).where(eq(jobs.status, 'active'))
  const activeJobs = activeRow?.n ?? 0

  const [runsTodayRow] = await db
    .select({ n: count() })
    .from(runs)
    .where(gte(runs.startedAt, dayAgo))
  const runsToday = runsTodayRow?.n ?? 0

  const [failingTodayRow] = await db
    .select({ n: sql<number>`count(distinct ${runs.jobId})` })
    .from(runs)
    .where(and(gte(runs.completedAt, dayAgo), inArray(runs.outcome, ['failure', 'timeout'])))
  const failingToday = failingTodayRow?.n ?? 0

  const [success7d] = await db
    .select({ n: count() })
    .from(runs)
    .where(and(gte(runs.completedAt, sevenDaysAgo), eq(runs.outcome, 'success')))
  const [total7d] = await db
    .select({ n: count() })
    .from(runs)
    .where(
      and(
        gte(runs.completedAt, sevenDaysAgo),
        inArray(runs.outcome, ['success', 'failure', 'timeout']),
      ),
    )
  const successRate7d =
    total7d?.n && total7d.n > 0 ? Math.round(((success7d?.n ?? 0) / total7d.n) * 1000) / 10 : 0

  return { activeJobs, failingToday, runsToday, successRate7d }
}

async function computeSparklines(db: Database, now: Date): Promise<Sparklines> {
  const dayAgo = new Date(now.getTime() - DAY_MS)
  const sevenDaysAgo = new Date(now.getTime() - 7 * DAY_MS)

  // Hourly buckets over last 24h for runs (total) and failures.
  const last24h = await db
    .select({
      hour: sql<number>`(${runs.startedAt} / ${HOUR_MS})`,
      outcome: runs.outcome,
      n: count(),
    })
    .from(runs)
    .where(gte(runs.startedAt, dayAgo))
    .groupBy(sql`(${runs.startedAt} / ${HOUR_MS})`, runs.outcome)

  const totalByHour = new Map<number, number>()
  const failByHour = new Map<number, number>()
  for (const row of last24h) {
    totalByHour.set(row.hour, (totalByHour.get(row.hour) ?? 0) + row.n)
    if (row.outcome === 'failure' || row.outcome === 'timeout') {
      failByHour.set(row.hour, (failByHour.get(row.hour) ?? 0) + row.n)
    }
  }

  const startHour = Math.floor(dayAgo.getTime() / HOUR_MS)
  const runsTodayPoints = Array.from({ length: 24 }, (_, i) => {
    const h = startHour + i
    return { t: h * HOUR_MS, v: totalByHour.get(h) ?? 0 }
  })
  const failingTodayPoints = Array.from({ length: 24 }, (_, i) => {
    const h = startHour + i
    return { t: h * HOUR_MS, v: failByHour.get(h) ?? 0 }
  })

  // Daily success rate over last 7 days.
  const last7d = await db
    .select({
      day: sql<number>`(${runs.completedAt} / ${DAY_MS})`,
      outcome: runs.outcome,
      n: count(),
    })
    .from(runs)
    .where(
      and(
        gte(runs.completedAt, sevenDaysAgo),
        inArray(runs.outcome, ['success', 'failure', 'timeout']),
      ),
    )
    .groupBy(sql`(${runs.completedAt} / ${DAY_MS})`, runs.outcome)

  const succByDay = new Map<number, number>()
  const totalByDay = new Map<number, number>()
  for (const row of last7d) {
    if (row.outcome === 'success') succByDay.set(row.day, (succByDay.get(row.day) ?? 0) + row.n)
    totalByDay.set(row.day, (totalByDay.get(row.day) ?? 0) + row.n)
  }

  const startDay = Math.floor(sevenDaysAgo.getTime() / DAY_MS)
  const successRate7dPoints = Array.from({ length: 7 }, (_, i) => {
    const d = startDay + i
    const total = totalByDay.get(d) ?? 0
    const rate = total > 0 ? ((succByDay.get(d) ?? 0) / total) * 100 : 0
    return { t: d * DAY_MS, v: Math.round(rate * 10) / 10 }
  })

  // activeJobs sparkline: no historical snapshots in v1; emit a flat
  // 7-point series at the current count so the trend reads as 0.
  const [activeRow] = await db.select({ n: count() }).from(jobs).where(eq(jobs.status, 'active'))
  const activeCurrent = activeRow?.n ?? 0
  const activeJobsPoints = Array.from({ length: 7 }, (_, i) => ({
    t: (startDay + i) * DAY_MS,
    v: activeCurrent,
  }))

  return {
    activeJobs: activeJobsPoints,
    failingToday: failingTodayPoints,
    runsToday: runsTodayPoints,
    successRate7d: successRate7dPoints,
  }
}

async function computeRunsSeries7d(db: Database, now: Date): Promise<RunsDailyBucket[]> {
  const sevenDaysAgo = new Date(now.getTime() - 7 * DAY_MS)
  const rows = await db
    .select({
      day: sql<number>`(${runs.completedAt} / ${DAY_MS})`,
      outcome: runs.outcome,
      n: count(),
    })
    .from(runs)
    .where(
      and(
        gte(runs.completedAt, sevenDaysAgo),
        inArray(runs.outcome, ['success', 'failure', 'timeout']),
      ),
    )
    .groupBy(sql`(${runs.completedAt} / ${DAY_MS})`, runs.outcome)

  const succ = new Map<number, number>()
  const fail = new Map<number, number>()
  for (const row of rows) {
    if (row.outcome === 'success') succ.set(row.day, (succ.get(row.day) ?? 0) + row.n)
    else fail.set(row.day, (fail.get(row.day) ?? 0) + row.n)
  }

  const startDay = Math.floor(sevenDaysAgo.getTime() / DAY_MS)
  return Array.from({ length: 7 }, (_, i) => {
    const d = startDay + i
    const date = new Date(d * DAY_MS)
    return {
      day: date.toISOString().slice(0, 10),
      success: succ.get(d) ?? 0,
      failure: fail.get(d) ?? 0,
    }
  })
}

async function computeNeedsAttention(db: Database, now: Date): Promise<NeedsAttentionRow[]> {
  const dayAgo = new Date(now.getTime() - DAY_MS)

  const paused = await db
    .select({
      customerSlug: customers.slug,
      customerName: customers.name,
      jobSlug: jobs.slug,
      jobName: jobs.name,
      lastFireAt: jobs.lastFireAt,
    })
    .from(jobs)
    .innerJoin(customers, eq(customers.id, jobs.customerId))
    .where(eq(jobs.status, 'paused'))
    .orderBy(desc(jobs.updatedAt))
    .limit(NEEDS_ATTENTION_LIMIT)

  const recentFailureJobIds = await db
    .selectDistinct({ jobId: runs.jobId })
    .from(runs)
    .where(and(gte(runs.completedAt, dayAgo), inArray(runs.outcome, ['failure', 'timeout'])))

  const failingJobIds = recentFailureJobIds.map((r) => r.jobId)
  const failing = failingJobIds.length
    ? await db
        .select({
          customerSlug: customers.slug,
          customerName: customers.name,
          jobSlug: jobs.slug,
          jobName: jobs.name,
          lastFailureAt: sql<number | null>`max(${runs.completedAt})`,
        })
        .from(jobs)
        .innerJoin(customers, eq(customers.id, jobs.customerId))
        .innerJoin(runs, eq(runs.jobId, jobs.id))
        .where(
          and(
            eq(jobs.status, 'active'),
            inArray(jobs.id, failingJobIds),
            gte(runs.completedAt, dayAgo),
            inArray(runs.outcome, ['failure', 'timeout']),
          ),
        )
        .groupBy(customers.slug, customers.name, jobs.slug, jobs.name)
        .orderBy(desc(sql`max(${runs.completedAt})`))
        .limit(NEEDS_ATTENTION_LIMIT)
    : []

  const rows: NeedsAttentionRow[] = [
    ...paused.map(
      (p): NeedsAttentionRow => ({
        customerSlug: p.customerSlug,
        customerName: p.customerName,
        jobSlug: p.jobSlug,
        jobName: p.jobName,
        status: 'paused',
        lastFailureAt: p.lastFireAt?.getTime() ?? null,
      }),
    ),
    ...failing.map(
      (f): NeedsAttentionRow => ({
        customerSlug: f.customerSlug,
        customerName: f.customerName,
        jobSlug: f.jobSlug,
        jobName: f.jobName,
        status: 'failing',
        lastFailureAt: f.lastFailureAt ?? null,
      }),
    ),
  ]
  return rows.slice(0, NEEDS_ATTENTION_LIMIT)
}

async function computeUpcomingFires(db: Database, now: Date): Promise<UpcomingFireRow[]> {
  const activeFireable = await db
    .select({
      customerSlug: customers.slug,
      customerName: customers.name,
      customerTimezone: customers.timezone,
      jobSlug: jobs.slug,
      jobName: jobs.name,
      triggerKind: jobs.triggerKind,
      cronExpression: jobs.cronExpression,
      intervalSeconds: jobs.intervalSeconds,
      triggerTimezone: jobs.triggerTimezone,
      lastFireAt: jobs.lastFireAt,
      nextFireAt: jobs.nextFireAt,
    })
    .from(jobs)
    .innerJoin(customers, eq(customers.id, jobs.customerId))
    .where(and(eq(jobs.status, 'active'), inArray(jobs.triggerKind, ['cron', 'interval'])))
    .limit(UPCOMING_FIRES_CAP)

  const upcoming: UpcomingFireRow[] = []
  for (const j of activeFireable) {
    const nextFireAt = computeNextFire(j, now)
    if (nextFireAt == null) continue
    upcoming.push({
      customerSlug: j.customerSlug,
      customerName: j.customerName,
      jobSlug: j.jobSlug,
      jobName: j.jobName,
      triggerSummary:
        j.triggerKind === 'cron'
          ? `cron ${j.cronExpression ?? ''}`
          : `every ${j.intervalSeconds ?? 0}s`,
      nextFireAt,
      timezone: j.triggerTimezone ?? j.customerTimezone,
    })
  }
  upcoming.sort((a, b) => a.nextFireAt - b.nextFireAt)
  return upcoming.slice(0, UPCOMING_FIRES_LIMIT)
}

interface FireableJob {
  triggerKind: string
  cronExpression: string | null
  intervalSeconds: number | null
  triggerTimezone: string | null
  customerTimezone: string
  lastFireAt: Date | null
  nextFireAt: Date | null
}

function computeNextFire(j: FireableJob, now: Date): number | null {
  if (j.nextFireAt && j.nextFireAt.getTime() > now.getTime()) {
    return j.nextFireAt.getTime()
  }
  if (j.triggerKind === 'cron' && j.cronExpression) {
    try {
      const cron = new Cron(j.cronExpression, {
        timezone: j.triggerTimezone ?? j.customerTimezone,
      })
      const next = cron.nextRun(now)
      return next?.getTime() ?? null
    } catch {
      return null
    }
  }
  if (j.triggerKind === 'interval' && j.intervalSeconds) {
    const last = j.lastFireAt?.getTime() ?? now.getTime()
    return last + j.intervalSeconds * 1000
  }
  return null
}

async function computeRecentFailures(db: Database): Promise<RecentFailureRow[]> {
  const rows = await db
    .select({
      runId: runs.id,
      customerSlug: customers.slug,
      customerName: customers.name,
      jobSlug: jobs.slug,
      jobName: jobs.name,
      outcome: runs.outcome,
      completedAt: runs.completedAt,
    })
    .from(runs)
    .innerJoin(jobs, eq(jobs.id, runs.jobId))
    .innerJoin(customers, eq(customers.id, runs.customerId))
    .where(inArray(runs.outcome, ['failure', 'timeout']))
    .orderBy(desc(runs.completedAt))
    .limit(RECENT_FAILURES_LIMIT)

  return rows.map((r) => ({
    runId: r.runId,
    customerSlug: r.customerSlug,
    customerName: r.customerName,
    jobSlug: r.jobSlug,
    jobName: r.jobName,
    outcome: (r.outcome as 'failure' | 'timeout') ?? 'failure',
    completedAt: r.completedAt?.getTime() ?? null,
  }))
}

