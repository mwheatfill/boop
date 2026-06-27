import { queryOptions } from '@tanstack/react-query'
import { listWorkspaceSecretsFn } from './server-fns'

export const workspaceSecretsQueryOptions = (workspaceSlug: string) =>
  queryOptions({
    queryKey: ['workspaces', workspaceSlug, 'secrets'],
    queryFn: () => listWorkspaceSecretsFn({ data: { workspaceSlug } }),
  })
