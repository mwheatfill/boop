import { queryOptions } from '@tanstack/react-query'
import { dashboardSummaryFn } from './server-fns'

export const dashboardSummaryQueryOptions = queryOptions({
  queryKey: ['dashboard', 'summary'],
  queryFn: () => dashboardSummaryFn(),
  staleTime: 30_000,
})
