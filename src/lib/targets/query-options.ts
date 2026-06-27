import { queryOptions } from '@tanstack/react-query'
import { listTargetsForWorkspaceFn } from '@/lib/targets/server-fns'

export function listTargetsQueryOptions(workspaceSlug: string) {
  return queryOptions({
    queryKey: ['workspaces', workspaceSlug, 'targets', { includeArchived: false }],
    queryFn: () => listTargetsForWorkspaceFn({ data: { workspaceSlug, includeArchived: false } }),
  })
}
