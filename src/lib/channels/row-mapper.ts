import type { channels } from '@/lib/db/schema'
import { type Channel, type ChannelKind, ChannelConfigSchema } from '@/shared/schemas/channel'

type ChannelRow = typeof channels.$inferSelect

export function rowToChannel(row: ChannelRow): Channel {
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
