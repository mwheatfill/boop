import { useQuery } from '@tanstack/react-query'
import { defaultWorkspaceQueryOptions } from './query-options'

export function useDefaultWorkspaceSlug(): string | undefined {
  const { data } = useQuery(defaultWorkspaceQueryOptions)
  return data?.slug
}
