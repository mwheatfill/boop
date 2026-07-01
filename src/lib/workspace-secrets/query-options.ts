import { queryOptions } from '@tanstack/react-query'
import { listWorkspaceSecretsFn } from './server-fns'

export const workspaceSecretKeys = {
  all: (workspaceSlug: string) => ['workspaces', workspaceSlug, 'secrets'] as const,
}

export const workspaceSecretsQueryOptions = (workspaceSlug: string) =>
  queryOptions({
    queryKey: workspaceSecretKeys.all(workspaceSlug),
    queryFn: () => listWorkspaceSecretsFn({ data: { workspaceSlug } }),
  })
