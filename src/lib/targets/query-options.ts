import { queryOptions } from '@tanstack/react-query'
import {
  getTargetFn,
  listTargetsForTunnelFn,
  listTargetsForWorkspaceFn,
} from '@/lib/targets/server-fns'

export const targetKeys = {
  all: (workspaceSlug: string) => ['workspaces', workspaceSlug, 'targets'] as const,
  detail: (workspaceSlug: string, targetSlug: string) =>
    [...targetKeys.all(workspaceSlug), targetSlug] as const,
  list: (workspaceSlug: string) =>
    [...targetKeys.all(workspaceSlug), { includeArchived: false }] as const,
  // Keyed under ['tunnels', …] so a tunnel verify/decommission invalidation also
  // refreshes the riding Targets' derived health.
  forTunnel: (tunnelId: string) => ['tunnels', tunnelId, 'targets'] as const,
}

export function targetQueryOptions(workspaceSlug: string, targetSlug: string) {
  return queryOptions({
    queryKey: targetKeys.detail(workspaceSlug, targetSlug),
    queryFn: () => getTargetFn({ data: { workspaceSlug, targetSlug } }),
  })
}

export function listTargetsQueryOptions(workspaceSlug: string) {
  return queryOptions({
    queryKey: targetKeys.list(workspaceSlug),
    queryFn: () => listTargetsForWorkspaceFn({ data: { workspaceSlug, includeArchived: false } }),
  })
}

export function targetsForTunnelQueryOptions(tunnelId: string) {
  return queryOptions({
    queryKey: targetKeys.forTunnel(tunnelId),
    queryFn: () => listTargetsForTunnelFn({ data: { tunnelId } }),
  })
}
