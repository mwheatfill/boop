import { queryOptions } from '@tanstack/react-query'
import { getChannelFn, listChannelsForPickerFn, listChannelsForWorkspaceFn } from './server-fns'

export const channelKeys = {
  all: (workspaceSlug: string) => ['workspaces', workspaceSlug, 'channels'] as const,
  list: (workspaceSlug: string, opts: { includeArchived: boolean }) =>
    [...channelKeys.all(workspaceSlug), opts] as const,
  detail: (workspaceSlug: string, channelSlug: string) =>
    [...channelKeys.all(workspaceSlug), channelSlug] as const,
  picker: (workspaceSlug: string) => [...channelKeys.all(workspaceSlug), 'picker'] as const,
}

export const listChannelsQueryOptions = (workspaceSlug: string, includeArchived = false) =>
  queryOptions({
    queryKey: channelKeys.list(workspaceSlug, { includeArchived }),
    queryFn: () => listChannelsForWorkspaceFn({ data: { workspaceSlug, includeArchived } }),
  })

export const channelQueryOptions = (workspaceSlug: string, channelSlug: string) =>
  queryOptions({
    queryKey: channelKeys.detail(workspaceSlug, channelSlug),
    queryFn: () => getChannelFn({ data: { workspaceSlug, channelSlug } }),
    refetchInterval: ({ state }) => {
      const data = state.data
      return data?.lastTestAlertStatus === 'pending' ? 2000 : false
    },
  })

export const channelPickerQueryOptions = (workspaceSlug: string) =>
  queryOptions({
    queryKey: channelKeys.picker(workspaceSlug),
    queryFn: () => listChannelsForPickerFn({ data: { workspaceSlug } }),
  })
