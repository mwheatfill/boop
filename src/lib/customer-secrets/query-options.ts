import { queryOptions } from '@tanstack/react-query'
import { listCustomerSecretsFn } from './server-fns'

export const customerSecretsQueryOptions = (customerSlug: string) =>
  queryOptions({
    queryKey: ['customers', customerSlug, 'secrets'],
    queryFn: () => listCustomerSecretsFn({ data: { customerSlug } }),
  })
