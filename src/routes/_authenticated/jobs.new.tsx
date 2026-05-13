import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { JobModal } from '@/components/forms/JobModal'
import { isAdmin } from '@/lib/auth/is-admin'
import { listCustomersQueryOptions, orgTimezoneQueryOptions } from '@/lib/customers/query-options'
import { listJobTemplatesQueryOptions } from '@/lib/job-templates/query-options'
import { z } from '@/shared/schemas/openapi'

const customersOptions = listCustomersQueryOptions(false)

export const Route = createFileRoute('/_authenticated/jobs/new')({
  validateSearch: z.object({ from: z.string().optional() }),
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(customersOptions),
      context.queryClient.ensureQueryData(orgTimezoneQueryOptions),
      context.queryClient.ensureQueryData(listJobTemplatesQueryOptions(undefined)),
    ])
  },
  component: NewJobAgnostic,
})

function NewJobAgnostic() {
  const search = Route.useSearch()
  const navigate = useNavigate()
  const { currentUser } = Route.useRouteContext()
  const { data: customers } = useSuspenseQuery(customersOptions)
  return (
    <JobModal
      variant="create"
      customers={customers}
      initialTemplateId={search.from}
      isAdmin={isAdmin(currentUser)}
      onClose={() => navigate({ to: '/jobs' })}
    />
  )
}
