import type { RunsFilters } from '@/lib/runs/filter-schema'

export const runsKeys = {
  lists: () => ['runs'] as const,
  list: (filters: RunsFilters) => [...runsKeys.lists(), filters] as const,
  detail: (workspaceSlug: string, jobSlug: string, runId: string) =>
    [...runsKeys.lists(), workspaceSlug, jobSlug, runId] as const,
  attemptBody: (attemptId: string, kind: 'request' | 'response') =>
    ['attempts', attemptId, 'body', kind] as const,
}
