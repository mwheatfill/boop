import { queryOptions } from '@tanstack/react-query'
import {
  getTargetFn,
  listTargetsForTunnelFn,
  listTargetsForWorkspaceFn,
} from '@/lib/targets/server-fns'

export function targetQueryOptions(workspaceSlug: string, targetSlug: string) {
  return queryOptions({
    queryKey: ['workspaces', workspaceSlug, 'targets', targetSlug],
    queryFn: () => getTargetFn({ data: { workspaceSlug, targetSlug } }),
  })
}

export function listTargetsQueryOptions(workspaceSlug: string) {
  return queryOptions({
    queryKey: ['workspaces', workspaceSlug, 'targets', { includeArchived: false }],
    queryFn: () => listTargetsForWorkspaceFn({ data: { workspaceSlug, includeArchived: false } }),
  })
}

// Keyed under ['tunnels', …] so a tunnel verify/decommission invalidation also
// refreshes the riding Targets' derived health.
export function targetsForTunnelQueryOptions(tunnelId: string) {
  return queryOptions({
    queryKey: ['tunnels', tunnelId, 'targets'],
    queryFn: () => listTargetsForTunnelFn({ data: { tunnelId } }),
  })
}
