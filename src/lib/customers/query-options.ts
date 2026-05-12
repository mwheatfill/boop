import { queryOptions } from '@tanstack/react-query'
import { getOrgTimezoneFn, listCustomersFn } from './server-fns'

export const listCustomersQueryOptions = (includeArchived = false) =>
  queryOptions({
    queryKey: ['customers', { includeArchived }],
    queryFn: () => listCustomersFn({ data: { includeArchived } }),
  })

export const orgTimezoneQueryOptions = queryOptions({
  queryKey: ['org', 'timezone'],
  queryFn: () => getOrgTimezoneFn(),
  staleTime: Number.POSITIVE_INFINITY,
})
