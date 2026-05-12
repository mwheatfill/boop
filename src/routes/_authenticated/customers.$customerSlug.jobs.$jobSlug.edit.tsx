import { queryOptions, useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { JobModal } from '@/components/forms/JobModal'
import { listCustomersFn } from '@/lib/customers/server-fns'
import { getJobFn } from '@/lib/jobs/server-fns'
import { listTargetsForCustomerFn } from '@/lib/targets/server-fns'

const jobOptions = (customerSlug: string, jobSlug: string) =>
  queryOptions({
    queryKey: ['customers', customerSlug, 'jobs', jobSlug],
    queryFn: () => getJobFn({ data: { customerSlug, jobSlug } }),
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

export const Route = createFileRoute('/_authenticated/customers/$customerSlug/jobs/$jobSlug/edit')({
  loader: ({ context, params }) =>
    Promise.all([
      context.queryClient.ensureQueryData(jobOptions(params.customerSlug, params.jobSlug)),
      context.queryClient.ensureQueryData(customersOptions),
      context.queryClient.ensureQueryData(targetsOptions(params.customerSlug)),
    ]),
  component: EditJobRoute,
})

function EditJobRoute() {
  const { customerSlug, jobSlug } = Route.useParams()
  const navigate = useNavigate()
  const { data: job } = useSuspenseQuery(jobOptions(customerSlug, jobSlug))
  const { data: customers } = useSuspenseQuery(customersOptions)
  const { data: targets } = useSuspenseQuery(targetsOptions(customerSlug))

  return (
    <JobModal
      variant="edit"
      initialJob={job}
      customers={customers}
      initialTargets={targets}
      onClose={() =>
        navigate({
          to: '/customers/$customerSlug/jobs/$jobSlug',
          params: { customerSlug, jobSlug },
        })
      }
    />
  )
}
