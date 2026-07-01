import { queryOptions } from '@tanstack/react-query'
import { dashboardSummaryFn } from './server-fns'

export const dashboardKeys = {
  all: () => ['dashboard'] as const,
  summary: () => [...dashboardKeys.all(), 'summary'] as const,
}

export const dashboardSummaryQueryOptions = queryOptions({
  queryKey: dashboardKeys.summary(),
  queryFn: () => dashboardSummaryFn(),
  staleTime: 30_000,
})
