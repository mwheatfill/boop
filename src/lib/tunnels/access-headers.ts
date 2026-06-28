import { eq } from 'drizzle-orm'
import type { Database } from '@/lib/db/client'
import { tunnels } from '@/lib/db/schema'
import { fetchActiveSecretPlaintext, SecretNotFoundError } from '@/lib/workspace-secrets/commands'
import type { Target } from '@/shared/schemas/target'

// Raised when a tunnel-reachable Target's Access Service Token cannot be
// resolved (tunnel gone, secret missing/revoked, or no KEK). The dispatcher
// records it as failure_kind = 'tunnel_credential_missing'.
export class TunnelCredentialError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TunnelCredentialError'
  }
}

type AccessTarget = Pick<Target, 'reachability' | 'tunnelId' | 'workspaceId'>

// Returns the Cloudflare Access Service Token headers for a tunnel-reachable
// Target, or {} for a public one. Throws TunnelCredentialError when the tunnel
// or its stored secrets are unavailable.
export async function buildAccessHeaders(
  deps: { db: Database; kek: string },
  target: AccessTarget,
): Promise<Record<string, string>> {
  if (target.reachability !== 'tunnel') return {}
  // A tunnel target with no tunnel assigned must fail loudly, never send the
  // request without Access headers (which could reach the origin unauthenticated).
  if (!target.tunnelId) {
    throw new TunnelCredentialError('Tunnel target has no tunnel assigned')
  }
  const { db, kek } = deps
  if (!kek) {
    throw new TunnelCredentialError('Secrets KEK is not configured')
  }

  const tunnel = (
    await db.select().from(tunnels).where(eq(tunnels.id, target.tunnelId)).limit(1)
  )[0]
  if (!tunnel) {
    throw new TunnelCredentialError(`Tunnel ${target.tunnelId} not found`)
  }

  try {
    const [clientId, clientSecret] = await Promise.all([
      fetchActiveSecretPlaintext({ db, kek }, target.workspaceId, tunnel.clientIdSecretName),
      fetchActiveSecretPlaintext({ db, kek }, target.workspaceId, tunnel.clientSecretSecretName),
    ])
    return { 'CF-Access-Client-Id': clientId, 'CF-Access-Client-Secret': clientSecret }
  } catch (err) {
    // A missing/revoked secret is a genuine credential failure; let transient
    // infra errors propagate so the dispatcher's normal handling applies.
    if (err instanceof SecretNotFoundError) {
      throw new TunnelCredentialError(`Access credential unavailable: ${err.message}`)
    }
    throw err
  }
}
