import { Cron } from 'croner'
import { and, eq, isNull, lte, or } from 'drizzle-orm'
import type { AlertQueueMessage } from '@/lib/alert-queue/types'
import { evaluateMissedSchedules } from '@/lib/alert-rules/missed-schedule'
import type { Database } from '@/lib/db/client'
import { createDb } from '@/lib/db/client'
import { jobs, workspaces } from '@/lib/db/schema'
import { logError, logInfo, logWarn } from '@/lib/log'
import { refreshTunnelHealth } from '@/lib/tunnels/health-check'
import { getProviderConfig, TunnelProvisioningNotConfiguredError } from '@/lib/tunnels/provider'

const STALE_CLAIM_MS = 300_000

export interface DispatchMessage {
  jobId: string
  scheduledAt: Date
  triggerSource?: 'cron' | 'webhook' | 'manual'
  runId?: string
}

export interface ScheduledEnv {
  DB: D1Database
  DISPATCH_QUEUE: Queue<DispatchMessage>
  ALERT_QUEUE?: Queue<AlertQueueMessage>
  BOOP_SECRETS_KEK?: SecretsStoreSecret
  CF_PROVIDER_API_TOKEN?: string
  CF_PROVIDER_ACCOUNT_ID?: string
  CF_PROVIDER_ZONE_ID?: string
  CF_TUNNEL_HOSTNAME_BASE?: string
}

export interface ScheduledDeps {
  db: Database
  dispatchQueue: Queue<DispatchMessage>
  alertQueue?: Queue<AlertQueueMessage>
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
      workspaceTimezone: workspaces.timezone,
      nextFireAt: jobs.nextFireAt,
    })
    .from(jobs)
    .innerJoin(workspaces, eq(workspaces.id, jobs.workspaceId))
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
    effectiveTz: r.triggerTimezone ?? r.workspaceTimezone,
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
  alertQueue,
  now = () => new Date(),
}: ScheduledDeps): Promise<{ swept: number; enqueued: number; missedEnqueued: number }> {
  const tick = now()
  const [swept, due] = await Promise.all([sweepStaleClaims(db, tick), selectDueCronJobs(db, tick)])
  const results = await Promise.all(
    due.map(async (row) => {
      if (!row.cronExpression) return 0
      const fireNow = row.nextFireAt !== null
      if (fireNow) {
        await dispatchQueue.send({
          jobId: row.jobId,
          scheduledAt: tick,
          triggerSource: 'cron',
        })
      }
      const next = nextRunFor(row.cronExpression, row.effectiveTz, tick)
      if (next !== null) {
        const update: Partial<typeof jobs.$inferInsert> = { nextFireAt: next, updatedAt: tick }
        if (fireNow) update.lastFireAt = tick
        await db.update(jobs).set(update).where(eq(jobs.id, row.jobId))
      }
      return fireNow ? 1 : 0
    }),
  )
  const enqueued = results.reduce<number>((total, count) => total + count, 0)
  const missed = alertQueue
    ? await evaluateMissedSchedules({ db, alertQueue, now: () => tick })
    : { enqueued: 0 }
  logInfo('scheduled.tick', { swept, due: due.length, enqueued, missedEnqueued: missed.enqueued })
  return { swept, enqueued, missedEnqueued: missed.enqueued }
}

// Best-effort: skips silently when tunnel provisioning is not configured, so a
// missing provider token never breaks the heartbeat.
async function maybeRefreshTunnelHealth(env: ScheduledEnv): Promise<void> {
  try {
    const kek = await env.BOOP_SECRETS_KEK?.get()
    if (!kek) return
    const db = createDb(env.DB)
    const provider = getProviderConfig({
      apiToken: env.CF_PROVIDER_API_TOKEN ?? '',
      accountId: env.CF_PROVIDER_ACCOUNT_ID ?? '',
      zoneId: env.CF_PROVIDER_ZONE_ID ?? '',
      hostnameBase: env.CF_TUNNEL_HOSTNAME_BASE ?? '',
    })
    await refreshTunnelHealth({ db, cf: provider.cf, kek, zoneId: provider.zoneId })
  } catch (err) {
    // Not configured is the normal unconfigured state, not a problem worth a
    // per-minute warning. Only unexpected errors are logged.
    if (err instanceof TunnelProvisioningNotConfiguredError) return
    logWarn('tunnel.health_refresh_skipped', {
      reason: err instanceof Error ? err.message : 'unknown',
    })
  }
}

export async function scheduled(
  _controller: ScheduledController,
  env: ScheduledEnv,
  _ctx: ExecutionContext,
): Promise<void> {
  await Promise.all([
    runScheduled({
      db: createDb(env.DB),
      dispatchQueue: env.DISPATCH_QUEUE,
      ...(env.ALERT_QUEUE ? { alertQueue: env.ALERT_QUEUE } : {}),
    }),
    maybeRefreshTunnelHealth(env),
  ])
}
