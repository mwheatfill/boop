import { queryOptions } from '@tanstack/react-query'
import { getDefaultWorkspaceFn, getOrgTimezoneFn, listWorkspacesFn } from './server-fns'

export const workspaceKeys = {
  all: () => ['workspaces'] as const,
  list: (opts: { includeArchived: boolean }) => [...workspaceKeys.all(), opts] as const,
  default: () => [...workspaceKeys.all(), 'default'] as const,
  orgTimezone: () => ['org', 'timezone'] as const,
}

export const listWorkspacesQueryOptions = (includeArchived = false) =>
  queryOptions({
    queryKey: workspaceKeys.list({ includeArchived }),
    queryFn: () => listWorkspacesFn({ data: { includeArchived } }),
  })

export const defaultWorkspaceQueryOptions = queryOptions({
  queryKey: workspaceKeys.default(),
  queryFn: () => getDefaultWorkspaceFn(),
  staleTime: Number.POSITIVE_INFINITY,
})

export const orgTimezoneQueryOptions = queryOptions({
  queryKey: workspaceKeys.orgTimezone(),
  queryFn: () => getOrgTimezoneFn(),
  staleTime: Number.POSITIVE_INFINITY,
})
