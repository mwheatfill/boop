import { queryOptions } from '@tanstack/react-query'
import { getJobFn } from './server-fns'

export const jobKeys = {
  // Cross-workspace Jobs list (the /jobs page); not scoped to a Workspace.
  lists: () => ['jobs'] as const,
  list: (filters: { includeArchived?: boolean }) => [...jobKeys.lists(), filters] as const,
  // A Workspace's Jobs, rooted at the canonical Job path so invalidating a Job
  // also reaches its Runs and webhook secrets.
  all: (workspaceSlug: string) => ['workspaces', workspaceSlug, 'jobs'] as const,
  detail: (workspaceSlug: string, jobSlug: string) =>
    [...jobKeys.all(workspaceSlug), jobSlug] as const,
  runs: (workspaceSlug: string, jobSlug: string) =>
    [...jobKeys.detail(workspaceSlug, jobSlug), 'runs'] as const,
  webhookSecrets: (workspaceSlug: string, jobSlug: string) =>
    [...jobKeys.detail(workspaceSlug, jobSlug), 'webhook-secrets'] as const,
}

export const jobQueryOptions = (workspaceSlug: string, jobSlug: string) =>
  queryOptions({
    queryKey: jobKeys.detail(workspaceSlug, jobSlug),
    queryFn: () => getJobFn({ data: { workspaceSlug, jobSlug } }),
  })
