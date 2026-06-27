import { env } from 'cloudflare:workers'
import { createServerFn } from '@tanstack/react-start'
import { enqueueAlert } from '@/lib/alert-queue/producer'
import { adminMiddleware } from '@/lib/auth/admin-middleware'
import { authMiddleware } from '@/lib/auth/auth-middleware'
import { createDb } from '@/lib/db/client'
import { asMutationFailure, type MutationResult } from '@/lib/mutation-result'
import { type Channel, ChannelCreateInput, ChannelUpdateInput } from '@/shared/schemas/channel'
import { z } from '@/shared/schemas/openapi'
import {
  archiveChannel,
  createChannel,
  markChannelTestQueued,
  restoreChannel,
  updateChannel,
} from './commands'
import { getChannelBySlug, listChannelsForPicker, listChannelsForWorkspace } from './queries'

const slugPair = z.object({
  workspaceSlug: z.string().min(1),
  channelSlug: z.string().min(1),
})

export const listChannelsForWorkspaceFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator((data: { workspaceSlug: string; includeArchived?: boolean }) =>
    z
      .object({ workspaceSlug: z.string().min(1), includeArchived: z.boolean().optional() })
      .parse(data),
  )
  .handler(async ({ data }) =>
    listChannelsForWorkspace(
      createDb(env.DB),
      data.workspaceSlug,
      data.includeArchived ? { includeArchived: true } : {},
    ),
  )

export const getChannelFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator((data) => slugPair.parse(data))
  .handler(async ({ data }) =>
    getChannelBySlug(createDb(env.DB), data.workspaceSlug, data.channelSlug),
  )

export const createChannelFn = createServerFn({ method: 'POST' })
  .middleware([adminMiddleware])
  .inputValidator((data: { workspaceSlug: string } & z.infer<typeof ChannelCreateInput>) =>
    z
      .object({ workspaceSlug: z.string().min(1) })
      .extend(ChannelCreateInput.shape)
      .parse(data),
  )
  .handler(async ({ data }): Promise<MutationResult<Channel>> => {
    const { workspaceSlug, ...input } = data
    try {
      const channel = await createChannel(createDb(env.DB), workspaceSlug, input)
      return { ok: true, data: channel }
    } catch (err) {
      const failure = asMutationFailure(err)
      if (failure) return failure
      throw err
    }
  })

export const updateChannelFn = createServerFn({ method: 'POST' })
  .middleware([adminMiddleware])
  .inputValidator(
    (data: { workspaceSlug: string; channelSlug: string } & z.infer<typeof ChannelUpdateInput>) =>
      slugPair.extend(ChannelUpdateInput.shape).parse(data),
  )
  .handler(async ({ data }): Promise<MutationResult<Channel>> => {
    const { workspaceSlug, channelSlug, ...input } = data
    try {
      const channel = await updateChannel(createDb(env.DB), workspaceSlug, channelSlug, input)
      return { ok: true, data: channel }
    } catch (err) {
      const failure = asMutationFailure(err)
      if (failure) return failure
      throw err
    }
  })

export const archiveChannelFn = createServerFn({ method: 'POST' })
  .middleware([adminMiddleware])
  .inputValidator((data) => slugPair.parse(data))
  .handler(async ({ data }): Promise<MutationResult<Channel>> => {
    try {
      const channel = await archiveChannel(createDb(env.DB), data.workspaceSlug, data.channelSlug)
      return { ok: true, data: channel }
    } catch (err) {
      const failure = asMutationFailure(err)
      if (failure) return failure
      throw err
    }
  })

export const restoreChannelFn = createServerFn({ method: 'POST' })
  .middleware([adminMiddleware])
  .inputValidator((data) => slugPair.parse(data))
  .handler(async ({ data }) => ({
    ok: true as const,
    data: await restoreChannel(createDb(env.DB), data.workspaceSlug, data.channelSlug),
  }))

export const sendTestAlertFn = createServerFn({ method: 'POST' })
  .middleware([adminMiddleware])
  .inputValidator((data) => slugPair.parse(data))
  .handler(async ({ data }): Promise<MutationResult<Channel>> => {
    const db = createDb(env.DB)
    const channel = await getChannelBySlug(db, data.workspaceSlug, data.channelSlug)
    await Promise.all([
      markChannelTestQueued(db, channel.id),
      enqueueAlert(env.ALERT_QUEUE, {
        runId: `test_${channel.id}`,
        ruleId: 'test',
        channelId: channel.id,
        ruleName: 'Channel test',
        ruleKind: 'first_failure',
        test: true,
      }),
    ])
    return { ok: true, data: { ...channel, lastTestAlertStatus: 'pending' } }
  })

export const listChannelsForPickerFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator((data: { workspaceSlug: string }) =>
    z.object({ workspaceSlug: z.string().min(1) }).parse(data),
  )
  .handler(async ({ data }) => listChannelsForPicker(createDb(env.DB), data.workspaceSlug))
