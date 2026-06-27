import { and, eq } from 'drizzle-orm'
import { canArchiveChannel } from '@/lib/archive-policy/archive-policy'
import type { Database } from '@/lib/db/client'
import { newId } from '@/lib/db/ids'
import { channels } from '@/lib/db/schema'
import {
  ArchiveBlockedError,
  FieldValidationError,
  isUniqueConstraintViolation,
  NotFoundError,
} from '@/lib/errors'
import { normalizeSlug, resolveWorkspaceId } from '@/lib/workspaces/resolve'
import type { Channel, ChannelCreateInput, ChannelUpdateInput } from '@/shared/schemas/channel'
import { getChannelBySlug } from './queries'

function serializeConfig(config: ChannelCreateInput['config']): string {
  const { kind: _kind, ...rest } = config
  return JSON.stringify(rest)
}

export async function createChannel(
  db: Database,
  workspaceSlug: string,
  input: ChannelCreateInput,
): Promise<Channel> {
  const workspaceId = await resolveWorkspaceId(db, workspaceSlug)
  const slug = normalizeSlug(input.slug)
  const id = newId('chn')
  try {
    await db.insert(channels).values({
      id,
      workspaceId,
      kind: input.config.kind,
      name: input.name.trim(),
      slug,
      config: serializeConfig(input.config),
    })
  } catch (err) {
    if (isUniqueConstraintViolation(err, 'channels.slug')) {
      throw new FieldValidationError({
        slug: [`Slug '${slug}' is already in use by another Channel for this Workspace`],
      })
    }
    throw err
  }
  return getChannelBySlug(db, workspaceSlug, slug)
}

export async function updateChannel(
  db: Database,
  workspaceSlug: string,
  channelSlug: string,
  input: ChannelUpdateInput,
): Promise<Channel> {
  const workspaceId = await resolveWorkspaceId(db, workspaceSlug)
  const result = await db
    .update(channels)
    .set({
      name: input.name.trim(),
      kind: input.config.kind,
      config: serializeConfig(input.config),
      updatedAt: new Date(),
    })
    .where(and(eq(channels.workspaceId, workspaceId), eq(channels.slug, channelSlug)))
    .returning({ id: channels.id })
  if (result.length === 0) throw new NotFoundError('Channel', `${workspaceSlug}/${channelSlug}`)
  return getChannelBySlug(db, workspaceSlug, channelSlug)
}

export async function archiveChannel(
  db: Database,
  workspaceSlug: string,
  channelSlug: string,
): Promise<Channel> {
  const channel = await getChannelBySlug(db, workspaceSlug, channelSlug)
  const check = await canArchiveChannel(db, channel.id)
  if (!check.ok) throw new ArchiveBlockedError(check.blockingCount, 'channel')
  await db
    .update(channels)
    .set({ status: 'archived', updatedAt: new Date() })
    .where(eq(channels.id, channel.id))
  return getChannelBySlug(db, workspaceSlug, channelSlug)
}

export async function restoreChannel(
  db: Database,
  workspaceSlug: string,
  channelSlug: string,
): Promise<Channel> {
  const channel = await getChannelBySlug(db, workspaceSlug, channelSlug)
  await db
    .update(channels)
    .set({ status: 'active', updatedAt: new Date() })
    .where(eq(channels.id, channel.id))
  return getChannelBySlug(db, workspaceSlug, channelSlug)
}

export async function markChannelTestQueued(db: Database, channelId: string): Promise<void> {
  const now = new Date()
  await db
    .update(channels)
    .set({
      lastTestAlertAt: now,
      lastTestAlertStatus: 'pending',
      lastTestAlertReason: null,
      updatedAt: now,
    })
    .where(eq(channels.id, channelId))
}
