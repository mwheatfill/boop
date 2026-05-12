import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { JobModal } from '@/components/forms/JobModal'
import { isAdmin } from '@/lib/auth/is-admin'
import { listCustomersQueryOptions, orgTimezoneQueryOptions } from '@/lib/customers/query-options'

const customersOptions = listCustomersQueryOptions(false)

export const Route = createFileRoute('/_authenticated/jobs/new')({
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(customersOptions),
      context.queryClient.ensureQueryData(orgTimezoneQueryOptions),
    ])
  },
  component: NewJobAgnostic,
})

function NewJobAgnostic() {
  const navigate = useNavigate()
  const { currentUser } = Route.useRouteContext()
  const { data: customers } = useSuspenseQuery(customersOptions)
  return (
    <JobModal
      variant="create"
      customers={customers}
      isAdmin={isAdmin(currentUser)}
      onClose={() => navigate({ to: '/jobs' })}
    />
  )
}
