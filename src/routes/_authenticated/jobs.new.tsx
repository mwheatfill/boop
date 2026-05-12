import { queryOptions, useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { JobModal } from '@/components/forms/JobModal'
import { listCustomersFn } from '@/lib/customers/server-fns'

const customersOptions = queryOptions({
  queryKey: ['customers', { includeArchived: false }],
  queryFn: () => listCustomersFn({ data: { includeArchived: false } }),
})

export const Route = createFileRoute('/_authenticated/jobs/new')({
  loader: ({ context }) => context.queryClient.ensureQueryData(customersOptions),
  component: NewJobAgnostic,
})

function NewJobAgnostic() {
  const navigate = useNavigate()
  const { data: customers } = useSuspenseQuery(customersOptions)
  return (
    <JobModal variant="create" customers={customers} onClose={() => navigate({ to: '/jobs' })} />
  )
}
