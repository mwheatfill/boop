import { queryOptions } from '@tanstack/react-query'
import { listDeletedFn } from './server-fns'

export const recycleBinKeys = {
  all: () => ['recycle-bin'] as const,
}

export const listDeletedQueryOptions = () =>
  queryOptions({
    queryKey: recycleBinKeys.all(),
    queryFn: () => listDeletedFn(),
  })
