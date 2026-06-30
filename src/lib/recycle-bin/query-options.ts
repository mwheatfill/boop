import { queryOptions } from '@tanstack/react-query'
import { listDeletedFn } from './server-fns'

export const listDeletedQueryOptions = () =>
  queryOptions({
    queryKey: ['recycle-bin'],
    queryFn: () => listDeletedFn(),
  })
