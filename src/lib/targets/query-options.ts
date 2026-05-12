import { queryOptions } from '@tanstack/react-query'
import { listTargetsForCustomerFn } from '@/lib/targets/server-fns'

export function listTargetsQueryOptions(customerSlug: string) {
  return queryOptions({
    queryKey: ['customers', customerSlug, 'targets', { includeArchived: false }],
    queryFn: () => listTargetsForCustomerFn({ data: { customerSlug, includeArchived: false } }),
  })
}
