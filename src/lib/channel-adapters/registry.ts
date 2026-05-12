import type { ChannelKind } from '@/shared/schemas/channel'
import { deliverEmail } from './email'
import { deliverTeams } from './teams'
import type { AdapterFn } from './types'
import { deliverWebhook } from './webhook'

const ADAPTERS: Record<ChannelKind, AdapterFn> = {
  teams: deliverTeams,
  email: deliverEmail,
  webhook: deliverWebhook,
}

export function adapterFor(kind: ChannelKind): AdapterFn {
  return ADAPTERS[kind]
}
