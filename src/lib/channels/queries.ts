import { and, asc, eq } from 'drizzle-orm'
import { resolveCustomerId } from '@/lib/customers/resolve'
import type { Database } from '@/lib/db/client'
import { channels } from '@/lib/db/schema'
import { NotFoundError } from '@/lib/errors'
import { type Channel, ChannelConfigSchema, type ChannelKind } from '@/shared/schemas/channel'

type ChannelRow = typeof channels.$inferSelect

function toChannel(row: ChannelRow): Channel {
  const config = ChannelConfigSchema.parse({ kind: row.kind, ...JSON.parse(row.config || '{}') })
  return {
    id: row.id,
    customerId: row.customerId,
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

export async function listChannelsForCustomer(
  db: Database,
  customerSlug: string,
  { includeArchived = false }: { includeArchived?: boolean } = {},
): Promise<Channel[]> {
  const customerId = await resolveCustomerId(db, customerSlug)
  const rows = includeArchived
    ? await db
        .select()
        .from(channels)
        .where(eq(channels.customerId, customerId))
        .orderBy(asc(channels.name))
    : await db
        .select()
        .from(channels)
        .where(and(eq(channels.customerId, customerId), eq(channels.status, 'active')))
        .orderBy(asc(channels.name))
  return rows.map(toChannel)
}

export async function getChannelBySlug(
  db: Database,
  customerSlug: string,
  channelSlug: string,
): Promise<Channel> {
  const customerId = await resolveCustomerId(db, customerSlug)
  const row = (
    await db
      .select()
      .from(channels)
      .where(and(eq(channels.customerId, customerId), eq(channels.slug, channelSlug)))
      .limit(1)
  )[0]
  if (!row) throw new NotFoundError('Channel', `${customerSlug}/${channelSlug}`)
  return toChannel(row)
}

export async function findChannelById(db: Database, channelId: string): Promise<Channel | null> {
  const row = (await db.select().from(channels).where(eq(channels.id, channelId)).limit(1))[0]
  return row ? toChannel(row) : null
}

export async function getChannelById(db: Database, channelId: string): Promise<Channel> {
  const channel = await findChannelById(db, channelId)
  if (!channel) throw new NotFoundError('Channel', channelId)
  return channel
}
