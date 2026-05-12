import { and, asc, eq } from 'drizzle-orm'
import type { Database } from '@/lib/db/client'
import { channels, customers } from '@/lib/db/schema'
import { NotFoundError } from '@/lib/errors'
import type { Channel } from '@/shared/schemas/channel'
import { rowToChannel } from './row-mapper'

async function resolveCustomerId(db: Database, customerSlug: string): Promise<string> {
  const row = (
    await db.select().from(customers).where(eq(customers.slug, customerSlug)).limit(1)
  )[0]
  if (!row) throw new NotFoundError('Customer', customerSlug)
  return row.id
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
  return rows.map(rowToChannel)
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
  return rowToChannel(row)
}

export async function getChannelById(db: Database, channelId: string): Promise<Channel> {
  const row = (await db.select().from(channels).where(eq(channels.id, channelId)).limit(1))[0]
  if (!row) throw new NotFoundError('Channel', channelId)
  return rowToChannel(row)
}
