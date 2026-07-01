import { and, asc, eq } from 'drizzle-orm'
import type { CertStatus } from '@/lib/cloudflare-api/client'
import type { Database } from '@/lib/db/client'
import { tunnels } from '@/lib/db/schema'
import { NotFoundError } from '@/lib/errors'
import type { Tunnel } from '@/shared/schemas/tunnel'
import { projectTunnel } from './health-projection'

type TunnelRow = typeof tunnels.$inferSelect

function toTunnel(row: TunnelRow): Tunnel {
  const { state } = projectTunnel(row)
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    name: row.name,
    slug: row.slug,
    hostname: row.hostname,
    connectorStatus: row.connectorStatus ?? null,
    connectorCheckedAt: row.connectorCheckedAt ? row.connectorCheckedAt.toISOString() : null,
    certStatus: (row.certStatus ?? null) as CertStatus | null,
    lastVerifyOutcome: row.lastVerifyOutcome ?? null,
    lastVerifiedAt: row.lastVerifiedAt ? row.lastVerifiedAt.toISOString() : null,
    state,
    status: row.status as Tunnel['status'],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export async function listTunnels(db: Database, workspaceId: string): Promise<Tunnel[]> {
  const rows = await db
    .select()
    .from(tunnels)
    .where(and(eq(tunnels.workspaceId, workspaceId), eq(tunnels.status, 'active')))
    .orderBy(asc(tunnels.name))
  return rows.map(toTunnel)
}

export async function getTunnelBySlug(
  db: Database,
  workspaceId: string,
  slug: string,
): Promise<Tunnel> {
  const row = (
    await db
      .select()
      .from(tunnels)
      .where(
        and(
          eq(tunnels.workspaceId, workspaceId),
          eq(tunnels.slug, slug),
          eq(tunnels.status, 'active'),
        ),
      )
      .limit(1)
  )[0]
  if (!row) throw new NotFoundError('Tunnel', slug)
  return toTunnel(row)
}
