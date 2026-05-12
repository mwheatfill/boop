import { queryOptions } from '@tanstack/react-query'
import { getChannelFn, listChannelsForCustomerFn } from './server-fns'

export const listChannelsQueryOptions = (customerSlug: string, includeArchived = false) =>
  queryOptions({
    queryKey: ['customers', customerSlug, 'channels', { includeArchived }],
    queryFn: () => listChannelsForCustomerFn({ data: { customerSlug, includeArchived } }),
  })

export const channelQueryOptions = (customerSlug: string, channelSlug: string) =>
  queryOptions({
    queryKey: ['customers', customerSlug, 'channels', channelSlug],
    queryFn: () => getChannelFn({ data: { customerSlug, channelSlug } }),
    refetchInterval: ({ state }) => {
      const data = state.data
      return data?.lastTestAlertStatus === 'pending' ? 2000 : false
    },
  })
