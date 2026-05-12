import { queryOptions, useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { JobModal } from '@/components/forms/JobModal'
import { isAdmin } from '@/lib/auth/is-admin'
import { getCustomerFn, listCustomersFn } from '@/lib/customers/server-fns'
import { listTargetsForCustomerFn } from '@/lib/targets/server-fns'

const customerOptions = (slug: string) =>
  queryOptions({
    queryKey: ['customers', slug],
    queryFn: () => getCustomerFn({ data: { slug } }),
  })

const customersOptions = queryOptions({
  queryKey: ['customers', { includeArchived: false }],
  queryFn: () => listCustomersFn({ data: { includeArchived: false } }),
})

const targetsOptions = (customerSlug: string) =>
  queryOptions({
    queryKey: ['customers', customerSlug, 'targets', { includeArchived: false }],
    queryFn: () => listTargetsForCustomerFn({ data: { customerSlug, includeArchived: false } }),
  })

export const Route = createFileRoute('/_authenticated/customers/$customerSlug/jobs/new')({
  loader: ({ context, params }) =>
    Promise.all([
      context.queryClient.ensureQueryData(customerOptions(params.customerSlug)),
      context.queryClient.ensureQueryData(customersOptions),
      context.queryClient.ensureQueryData(targetsOptions(params.customerSlug)),
    ]),
  component: NewJobRoute,
})

function NewJobRoute() {
  const { customerSlug } = Route.useParams()
  const navigate = useNavigate()
  const { currentUser } = Route.useRouteContext()
  const { data: customer } = useSuspenseQuery(customerOptions(customerSlug))
  const { data: customers } = useSuspenseQuery(customersOptions)
  const { data: targets } = useSuspenseQuery(targetsOptions(customerSlug))

  return (
    <JobModal
      variant="create"
      presetCustomer={customer}
      customers={customers}
      initialTargets={targets}
      isAdmin={isAdmin(currentUser)}
      onClose={() => navigate({ to: '/customers/$customerSlug', params: { customerSlug } })}
    />
  )
}
