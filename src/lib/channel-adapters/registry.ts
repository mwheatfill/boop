import type { AlertContext } from '@/shared/schemas/alert-context'
import type { ChannelConfig, ChannelKind } from '@/shared/schemas/channel'
import { deliverEmail } from './email'
import { deliverTeams } from './teams'
import type { AdapterFn, AdapterResult } from './types'
import { deliverWebhook } from './webhook'

export type ChannelAdapter = (config: ChannelConfig, ctx: AlertContext) => Promise<AdapterResult>

const ADAPTERS = {
  teams: deliverTeams,
  email: deliverEmail,
  webhook: deliverWebhook,
} satisfies { [K in ChannelKind]: AdapterFn<Extract<ChannelConfig, { kind: K }>> }

export function adapterFor(kind: ChannelKind): ChannelAdapter {
  return ADAPTERS[kind] as ChannelAdapter
}
