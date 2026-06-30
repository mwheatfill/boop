import { and, asc, eq } from 'drizzle-orm'
import type { Database } from '@/lib/db/client'
import { channels } from '@/lib/db/schema'
import { NotFoundError } from '@/lib/errors'
import { resolveWorkspaceId } from '@/lib/workspaces/resolve'
import { type Channel, ChannelConfigSchema, type ChannelKind } from '@/shared/schemas/channel'

type ChannelRow = typeof channels.$inferSelect

function toChannel(row: ChannelRow): Channel {
  const config = ChannelConfigSchema.parse({ kind: row.kind, ...JSON.parse(row.config || '{}') })
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    kind: row.kind as ChannelKind,
    name: row.name,
    slug: row.slug,
    config,
    status: row.status as Channel['status'],
    lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
    lastTestAlertAt: row.lastTestAlertAt?.toISOString() ?? null,
    lastTestAlertStatus: (row.lastTestAlertStatus ?? null) as Channel['lastTestAlertStatus'],
    lastTestAlertReason: row.lastTestAlertReason,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export async function listChannelsForWorkspace(
  db: Database,
  workspaceSlug: string,
  { includeArchived = false }: { includeArchived?: boolean } = {},
): Promise<Channel[]> {
  const workspaceId = await resolveWorkspaceId(db, workspaceSlug)
  const conditions = [eq(channels.workspaceId, workspaceId)]
  if (!includeArchived) conditions.push(eq(channels.status, 'active'))
  const rows = await db
    .select()
    .from(channels)
    .where(and(...conditions))
    .orderBy(asc(channels.name))
  return rows.map(toChannel)
}

export async function listChannelsForPicker(
  db: Database,
  workspaceSlug: string,
): Promise<Channel[]> {
  const workspaceId = await resolveWorkspaceId(db, workspaceSlug)
  const rows = await db
    .select()
    .from(channels)
    .where(and(eq(channels.status, 'active'), eq(channels.workspaceId, workspaceId)))
    .orderBy(asc(channels.name))
  return rows.map(toChannel)
}

export async function getChannelBySlug(
  db: Database,
  workspaceSlug: string,
  channelSlug: string,
): Promise<Channel> {
  const workspaceId = await resolveWorkspaceId(db, workspaceSlug)
  const row = (
    await db
      .select()
      .from(channels)
      .where(and(eq(channels.workspaceId, workspaceId), eq(channels.slug, channelSlug)))
      .limit(1)
  )[0]
  if (!row) throw new NotFoundError('Channel', `${workspaceSlug}/${channelSlug}`)
  return toChannel(row)
}

// Resolves a Channel for alert delivery. A deleted (archived) Channel is not
// deliverable, so it resolves to null and the consumer skips it.
export async function findChannelById(db: Database, channelId: string): Promise<Channel | null> {
  const row = (
    await db
      .select()
      .from(channels)
      .where(and(eq(channels.id, channelId), eq(channels.status, 'active')))
      .limit(1)
  )[0]
  return row ? toChannel(row) : null
}
