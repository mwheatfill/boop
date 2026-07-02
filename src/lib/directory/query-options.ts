import { queryOptions } from '@tanstack/react-query'
import { searchDirectoryFn } from './server-fns'

export const directoryKeys = {
  all: (workspaceSlug: string) => ['workspaces', workspaceSlug, 'directory'] as const,
  search: (workspaceSlug: string, query: string) =>
    [...directoryKeys.all(workspaceSlug), query] as const,
}

export const directorySearchQueryOptions = (workspaceSlug: string, query: string) =>
  queryOptions({
    queryKey: directoryKeys.search(workspaceSlug, query),
    queryFn: () => searchDirectoryFn({ data: { workspaceSlug, query } }),
    enabled: query.trim().length > 0,
    staleTime: 60_000,
  })
