import { and, eq } from 'drizzle-orm'
import type { Database } from '@/lib/db/client'
import { targets, tunnels } from '@/lib/db/schema'
import { NotFoundError } from '@/lib/errors'
import type { TunnelVerifyResult } from '@/shared/schemas/tunnel'
import { buildAccessHeaders, TunnelCredentialError } from './access-headers'

const VERIFY_TIMEOUT_MS = 5000

// Fires a HEAD through the tunnel hostname with the Access headers and maps the
// response to a verify outcome. Pure aside from the injected fetch.
export async function verifyTunnelConnection(
  fetchImpl: typeof fetch,
  url: string,
  headers: Record<string, string>,
): Promise<TunnelVerifyResult> {
  try {
    const res = await fetchImpl(url, {
      method: 'HEAD',
      headers,
      signal: AbortSignal.timeout(VERIFY_TIMEOUT_MS),
    })
    if (res.ok) return { ok: true, outcome: 'ok', detail: 'Connected.' }
    if (res.status === 401) {
      return {
        ok: false,
        outcome: 'unauthorized',
        detail: "Access didn't recognize the Service Token. Recheck the Client ID and Secret.",
      }
    }
    if (res.status === 403) {
      return {
        ok: false,
        outcome: 'forbidden',
        detail: 'Access policy denied the request. Review the policy on your Tunnel hostname.',
      }
    }
    return { ok: false, outcome: 'unknown', detail: `Unexpected status ${res.status}.` }
  } catch (err) {
    return {
      ok: false,
      outcome: 'network',
      detail: err instanceof Error ? err.message : "Couldn't reach the URL.",
    }
  }
}

export interface RunTunnelVerifyDeps {
  db: Database
  kek: string
  fetchImpl?: typeof fetch
  now?: () => Date
}

// Verifies a stored Tunnel end-to-end and records the outcome on the row.
export async function runTunnelVerify(
  deps: RunTunnelVerifyDeps,
  tunnelId: string,
): Promise<TunnelVerifyResult> {
  const { db, kek } = deps
  const fetchImpl = deps.fetchImpl ?? fetch
  const now = deps.now ?? (() => new Date())

  const tunnel = (await db.select().from(tunnels).where(eq(tunnels.id, tunnelId)).limit(1))[0]
  if (!tunnel) throw new NotFoundError('Tunnel', tunnelId)

  // Verify a representative active Target route (the connector has no single
  // origin; each private Target is its own route through this tunnel).
  const target = (
    await db
      .select()
      .from(targets)
      .where(and(eq(targets.tunnelId, tunnelId), eq(targets.status, 'active')))
      .limit(1)
  )[0]

  let result: TunnelVerifyResult
  if (!target) {
    result = { ok: false, outcome: 'unknown', detail: 'No private Targets use this tunnel yet.' }
  } else {
    try {
      const headers = await buildAccessHeaders(
        { db, kek },
        { reachability: 'tunnel', tunnelId, workspaceId: tunnel.workspaceId },
      )
      result = await verifyTunnelConnection(fetchImpl, target.url, headers)
    } catch (err) {
      if (!(err instanceof TunnelCredentialError)) throw err
      result = { ok: false, outcome: 'unknown', detail: err.message }
    }
  }

  const checkedAt = now()
  await db
    .update(tunnels)
    .set({ lastVerifyOutcome: result.outcome, lastVerifiedAt: checkedAt, updatedAt: checkedAt })
    .where(eq(tunnels.id, tunnelId))
  return result
}
