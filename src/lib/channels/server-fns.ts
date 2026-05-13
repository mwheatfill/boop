import { env } from 'cloudflare:workers'
import { createServerFn } from '@tanstack/react-start'
import { enqueueAlert } from '@/lib/alert-queue/producer'
import { canArchiveWorkspaceChannel } from '@/lib/archive-policy/archive-policy'
import { adminMiddleware } from '@/lib/auth/admin-middleware'
import { authMiddleware } from '@/lib/auth/auth-middleware'
import { createDb } from '@/lib/db/client'
import { asMutationFailure, type MutationResult, runMutation } from '@/lib/mutation-result'
import { type Channel, ChannelCreateInput, ChannelUpdateInput } from '@/shared/schemas/channel'
import { z } from '@/shared/schemas/openapi'
import {
  archiveChannel,
  archiveWorkspaceChannel,
  createChannel,
  createWorkspaceChannel,
  markChannelTestQueued,
  restoreChannel,
  restoreWorkspaceChannel,
  updateChannel,
  updateWorkspaceChannel,
} from './commands'
import {
  getChannelBySlug,
  getWorkspaceChannelBySlug,
  listChannelsForCustomer,
  listChannelsForPicker,
  listWorkspaceChannels,
} from './queries'

const slugPair = z.object({
  customerSlug: z.string().min(1),
  channelSlug: z.string().min(1),
})

export const listChannelsForCustomerFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator((data: { customerSlug: string; includeArchived?: boolean }) =>
    z
      .object({ customerSlug: z.string().min(1), includeArchived: z.boolean().optional() })
      .parse(data),
  )
  .handler(async ({ data }) =>
    listChannelsForCustomer(
      createDb(env.DB),
      data.customerSlug,
      data.includeArchived ? { includeArchived: true } : {},
    ),
  )

export const getChannelFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator((data) => slugPair.parse(data))
  .handler(async ({ data }) =>
    getChannelBySlug(createDb(env.DB), data.customerSlug, data.channelSlug),
  )

export const createChannelFn = createServerFn({ method: 'POST' })
  .middleware([adminMiddleware])
  .inputValidator((data: { customerSlug: string } & z.infer<typeof ChannelCreateInput>) =>
    z
      .object({ customerSlug: z.string().min(1) })
      .extend(ChannelCreateInput.shape)
      .parse(data),
  )
  .handler(async ({ data }): Promise<MutationResult<Channel>> => {
    const { customerSlug, ...input } = data
    try {
      const channel = await createChannel(createDb(env.DB), customerSlug, input)
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
    (data: { customerSlug: string; channelSlug: string } & z.infer<typeof ChannelUpdateInput>) =>
      slugPair.extend(ChannelUpdateInput.shape).parse(data),
  )
  .handler(async ({ data }): Promise<MutationResult<Channel>> => {
    const { customerSlug, channelSlug, ...input } = data
    try {
      const channel = await updateChannel(createDb(env.DB), customerSlug, channelSlug, input)
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
      const channel = await archiveChannel(createDb(env.DB), data.customerSlug, data.channelSlug)
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
    data: await restoreChannel(createDb(env.DB), data.customerSlug, data.channelSlug),
  }))

export const sendTestAlertFn = createServerFn({ method: 'POST' })
  .middleware([adminMiddleware])
  .inputValidator((data) => slugPair.parse(data))
  .handler(async ({ data }): Promise<MutationResult<Channel>> => {
    const db = createDb(env.DB)
    const channel = await getChannelBySlug(db, data.customerSlug, data.channelSlug)
    await markChannelTestQueued(db, channel.id)
    await enqueueAlert(env.ALERT_QUEUE, {
      runId: `test_${channel.id}`,
      ruleId: 'test',
      channelId: channel.id,
      ruleName: 'Channel test',
      ruleKind: 'first_failure',
      test: true,
    })
    return { ok: true, data: { ...channel, lastTestAlertStatus: 'pending' } }
  })

const channelSlugOnly = z.object({ channelSlug: z.string().min(1) })

export const listChannelsForPickerFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator((data: { customerSlug: string }) =>
    z.object({ customerSlug: z.string().min(1) }).parse(data),
  )
  .handler(async ({ data }) => listChannelsForPicker(createDb(env.DB), data.customerSlug))

export const listWorkspaceChannelsFn = createServerFn({ method: 'GET' })
  .middleware([adminMiddleware])
  .inputValidator((data: { includeArchived?: boolean }) =>
    z.object({ includeArchived: z.boolean().optional() }).parse(data),
  )
  .handler(async ({ data }) =>
    listWorkspaceChannels(createDb(env.DB), data.includeArchived ? { includeArchived: true } : {}),
  )

export const getWorkspaceChannelFn = createServerFn({ method: 'GET' })
  .middleware([adminMiddleware])
  .inputValidator((data) => channelSlugOnly.parse(data))
  .handler(async ({ data }) => getWorkspaceChannelBySlug(createDb(env.DB), data.channelSlug))

export const createWorkspaceChannelFn = createServerFn({ method: 'POST' })
  .middleware([adminMiddleware])
  .inputValidator((data: z.infer<typeof ChannelCreateInput>) => ChannelCreateInput.parse(data))
  .handler(({ data }) => runMutation(() => createWorkspaceChannel(createDb(env.DB), data)))

export const updateWorkspaceChannelFn = createServerFn({ method: 'POST' })
  .middleware([adminMiddleware])
  .inputValidator((data: { channelSlug: string } & z.infer<typeof ChannelUpdateInput>) =>
    channelSlugOnly.extend(ChannelUpdateInput.shape).parse(data),
  )
  .handler(({ data }) => {
    const { channelSlug, ...input } = data
    return runMutation(() => updateWorkspaceChannel(createDb(env.DB), channelSlug, input))
  })

export const archiveWorkspaceChannelFn = createServerFn({ method: 'POST' })
  .middleware([adminMiddleware])
  .inputValidator((data) => channelSlugOnly.parse(data))
  .handler(({ data }) =>
    runMutation(() => archiveWorkspaceChannel(createDb(env.DB), data.channelSlug)),
  )

export const restoreWorkspaceChannelFn = createServerFn({ method: 'POST' })
  .middleware([adminMiddleware])
  .inputValidator((data) => channelSlugOnly.parse(data))
  .handler(async ({ data }) => ({
    ok: true as const,
    data: await restoreWorkspaceChannel(createDb(env.DB), data.channelSlug),
  }))

export const canArchiveWorkspaceChannelFn = createServerFn({ method: 'GET' })
  .middleware([adminMiddleware])
  .inputValidator((data) => channelSlugOnly.parse(data))
  .handler(async ({ data }) => {
    const db = createDb(env.DB)
    const channel = await getWorkspaceChannelBySlug(db, data.channelSlug)
    return canArchiveWorkspaceChannel(db, channel.id)
  })

export const sendWorkspaceTestAlertFn = createServerFn({ method: 'POST' })
  .middleware([adminMiddleware])
  .inputValidator((data) => channelSlugOnly.parse(data))
  .handler(async ({ data }): Promise<MutationResult<Channel>> => {
    const db = createDb(env.DB)
    const channel = await getWorkspaceChannelBySlug(db, data.channelSlug)
    await markChannelTestQueued(db, channel.id)
    await enqueueAlert(env.ALERT_QUEUE, {
      runId: `test_${channel.id}`,
      ruleId: 'test',
      channelId: channel.id,
      ruleName: 'Channel test',
      ruleKind: 'first_failure',
      test: true,
    })
    return { ok: true, data: { ...channel, lastTestAlertStatus: 'pending' } }
  })
