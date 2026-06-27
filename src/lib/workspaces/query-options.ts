import { queryOptions } from '@tanstack/react-query'
import { getDefaultWorkspaceFn, getOrgTimezoneFn, listWorkspacesFn } from './server-fns'

export const listWorkspacesQueryOptions = (includeArchived = false) =>
  queryOptions({
    queryKey: ['workspaces', { includeArchived }],
    queryFn: () => listWorkspacesFn({ data: { includeArchived } }),
  })

export const defaultWorkspaceQueryOptions = queryOptions({
  queryKey: ['workspaces', 'default'],
  queryFn: () => getDefaultWorkspaceFn(),
  staleTime: Number.POSITIVE_INFINITY,
})

export const orgTimezoneQueryOptions = queryOptions({
  queryKey: ['org', 'timezone'],
  queryFn: () => getOrgTimezoneFn(),
  staleTime: Number.POSITIVE_INFINITY,
})
