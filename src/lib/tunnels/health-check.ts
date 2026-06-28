import { eq } from 'drizzle-orm'
import type { CloudflareApi } from '@/lib/cloudflare-api/client'
import type { Database } from '@/lib/db/client'
import { tunnels } from '@/lib/db/schema'
import { logWarn } from '@/lib/log'

export interface RefreshTunnelHealthDeps {
  db: Database
  cf: CloudflareApi
  zoneId: string
  now?: () => Date
}

// Heartbeat step: refresh each active tunnel's connector and certificate status
// from Cloudflare (both cheap). Origin reachability is a per-Target concern,
// surfaced by real Run outcomes and the on-demand Verify, not polled here.
export async function refreshTunnelHealth(
  deps: RefreshTunnelHealthDeps,
): Promise<{ checked: number }> {
  const { db, cf, zoneId } = deps
  const now = deps.now ?? (() => new Date())

  const active = await db.select().from(tunnels).where(eq(tunnels.status, 'active'))

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

    // Poll the cert every cycle (cheap) so a later renewal failure or expiry
    // surfaces, not just the initial issuance.
    if (tunnel.cfCertPackId) {
      try {
        const certStatus = await cf.getCertStatus(zoneId, tunnel.cfCertPackId)
        await db.update(tunnels).set({ certStatus, updatedAt: at }).where(eq(tunnels.id, tunnel.id))
      } catch {
        logWarn('tunnel.cert_poll_failed', { tunnelId: tunnel.id })
      }
    }
  }

  return { checked: active.length }
}
