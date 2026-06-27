import { queryOptions } from '@tanstack/react-query'
import { getChannelFn, listChannelsForPickerFn, listChannelsForWorkspaceFn } from './server-fns'

export const listChannelsQueryOptions = (workspaceSlug: string, includeArchived = false) =>
  queryOptions({
    queryKey: ['workspaces', workspaceSlug, 'channels', { includeArchived }],
    queryFn: () => listChannelsForWorkspaceFn({ data: { workspaceSlug, includeArchived } }),
  })

export const channelQueryOptions = (workspaceSlug: string, channelSlug: string) =>
  queryOptions({
    queryKey: ['workspaces', workspaceSlug, 'channels', channelSlug],
    queryFn: () => getChannelFn({ data: { workspaceSlug, channelSlug } }),
    refetchInterval: ({ state }) => {
      const data = state.data
      return data?.lastTestAlertStatus === 'pending' ? 2000 : false
    },
  })

export const channelPickerQueryOptions = (workspaceSlug: string) =>
  queryOptions({
    queryKey: ['workspaces', workspaceSlug, 'channels', 'picker'],
    queryFn: () => listChannelsForPickerFn({ data: { workspaceSlug } }),
  })
