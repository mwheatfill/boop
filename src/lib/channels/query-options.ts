import { queryOptions } from '@tanstack/react-query'
import {
  getChannelFn,
  getWorkspaceChannelFn,
  listChannelsForCustomerFn,
  listChannelsForPickerFn,
  listWorkspaceChannelsFn,
} from './server-fns'

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

export const channelPickerQueryOptions = (customerSlug: string) =>
  queryOptions({
    queryKey: ['customers', customerSlug, 'channels', 'picker'],
    queryFn: () => listChannelsForPickerFn({ data: { customerSlug } }),
  })

export const workspaceChannelsQueryOptions = (includeArchived = false) =>
  queryOptions({
    queryKey: ['workspace', 'channels', { includeArchived }],
    queryFn: () => listWorkspaceChannelsFn({ data: { includeArchived } }),
  })

export const workspaceChannelQueryOptions = (channelSlug: string) =>
  queryOptions({
    queryKey: ['workspace', 'channels', channelSlug],
    queryFn: () => getWorkspaceChannelFn({ data: { channelSlug } }),
    refetchInterval: ({ state }) => {
      const data = state.data
      return data?.lastTestAlertStatus === 'pending' ? 2000 : false
    },
  })
