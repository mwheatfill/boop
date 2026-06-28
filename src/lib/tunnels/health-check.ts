import { and, eq, gte } from 'drizzle-orm'
import type { CloudflareApi } from '@/lib/cloudflare-api/client'
import type { Database } from '@/lib/db/client'
import { jobs, runs, targets, tunnels } from '@/lib/db/schema'
import { logWarn } from '@/lib/log'
import { runTunnelVerify } from './verify'

const VERIFY_STALE_MS = 15 * 60 * 1000
const RECENT_RUN_SKIP_MS = 15 * 60 * 1000

export interface RefreshTunnelHealthDeps {
  db: Database
  cf: CloudflareApi
  kek: string
  now?: () => Date
  fetchImpl?: typeof fetch
}

// Only a recent SUCCESS proves the origin is reachable. A failing origin keeps
// producing failed Runs, so those must not suppress the verify, or a real
// outage would leave the last (stale, healthy) verify outcome on the row.
async function hasRecentSuccessfulRun(
  db: Database,
  tunnelId: string,
  since: Date,
): Promise<boolean> {
  const rows = await db
    .select({ id: runs.id })
    .from(runs)
    .innerJoin(jobs, eq(runs.jobId, jobs.id))
    .innerJoin(targets, eq(jobs.targetId, targets.id))
    .where(
      and(
        eq(targets.tunnelId, tunnelId),
        eq(runs.outcome, 'success'),
        gte(runs.completedAt, since),
      ),
    )
    .limit(1)
  return rows.length > 0
}

// Heartbeat step: refresh each active tunnel's connector status from Cloudflare
// (cheap), and run the origin-hitting verify only when it is stale AND no recent
// Run already exercised the origin, so the timer never re-probes needlessly.
export async function refreshTunnelHealth(
  deps: RefreshTunnelHealthDeps,
): Promise<{ checked: number; verified: number }> {
  const { db, cf, kek } = deps
  const now = deps.now ?? (() => new Date())
  const fetchImpl = deps.fetchImpl ?? fetch

  const active = await db.select().from(tunnels).where(eq(tunnels.status, 'active'))
  let verified = 0

  for (const tunnel of active) {
    const at = now()
    try {
      const status = await cf.getTunnelStatus(tunnel.cfTunnelId)
      await db
        .update(tunnels)
        .set({ connectorStatus: status, connectorCheckedAt: at, updatedAt: at })
        .where(eq(tunnels.id, tunnel.id))
    } catch {
      logWarn('tunnel.connector_poll_failed', { tunnelId: tunnel.id })
    }

    const stale =
      tunnel.lastVerifiedAt === null ||
      at.getTime() - tunnel.lastVerifiedAt.getTime() > VERIFY_STALE_MS
    if (stale) {
      const recent = await hasRecentSuccessfulRun(
        db,
        tunnel.id,
        new Date(at.getTime() - RECENT_RUN_SKIP_MS),
      )
      if (!recent) {
        const verifyDeps = deps.fetchImpl ? { db, kek, fetchImpl, now } : { db, kek, now }
        await runTunnelVerify(verifyDeps, tunnel.id)
        verified += 1
      }
    }
  }

  return { checked: active.length, verified }
}
