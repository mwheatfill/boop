import { and, asc, eq, isNull, or } from 'drizzle-orm'
import { resolveCustomerId } from '@/lib/customers/resolve'
import type { Database } from '@/lib/db/client'
import { channels } from '@/lib/db/schema'
import { NotFoundError } from '@/lib/errors'
import {
  type Channel,
  ChannelConfigSchema,
  type ChannelKind,
  type ChannelScope,
} from '@/shared/schemas/channel'

type ChannelRow = typeof channels.$inferSelect

function toChannel(row: ChannelRow): Channel {
  const config = ChannelConfigSchema.parse({ kind: row.kind, ...JSON.parse(row.config || '{}') })
  return {
    id: row.id,
    scope: row.scope as ChannelScope,
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
  const conditions = [eq(channels.scope, 'customer'), eq(channels.customerId, customerId)]
  if (!includeArchived) conditions.push(eq(channels.status, 'active'))
  const rows = await db
    .select()
    .from(channels)
    .where(and(...conditions))
    .orderBy(asc(channels.name))
  return rows.map(toChannel)
}

export async function listWorkspaceChannels(
  db: Database,
  { includeArchived = false }: { includeArchived?: boolean } = {},
): Promise<Channel[]> {
  const conditions = [eq(channels.scope, 'workspace')]
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
  customerSlug: string,
): Promise<Channel[]> {
  const customerId = await resolveCustomerId(db, customerSlug)
  const rows = await db
    .select()
    .from(channels)
    .where(
      and(
        eq(channels.status, 'active'),
        or(eq(channels.scope, 'workspace'), eq(channels.customerId, customerId)),
      ),
    )
    .orderBy(asc(channels.scope), asc(channels.name))
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
      .where(
        and(
          eq(channels.scope, 'customer'),
          eq(channels.customerId, customerId),
          eq(channels.slug, channelSlug),
        ),
      )
      .limit(1)
  )[0]
  if (!row) throw new NotFoundError('Channel', `${customerSlug}/${channelSlug}`)
  return toChannel(row)
}

export async function getWorkspaceChannelBySlug(
  db: Database,
  channelSlug: string,
): Promise<Channel> {
  const row = (
    await db
      .select()
      .from(channels)
      .where(
        and(
          eq(channels.scope, 'workspace'),
          isNull(channels.customerId),
          eq(channels.slug, channelSlug),
        ),
      )
      .limit(1)
  )[0]
  if (!row) throw new NotFoundError('Channel', `workspace/${channelSlug}`)
  return toChannel(row)
}

export async function findChannelById(db: Database, channelId: string): Promise<Channel | null> {
  const row = (await db.select().from(channels).where(eq(channels.id, channelId)).limit(1))[0]
  return row ? toChannel(row) : null
}
