import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { JobModal } from '@/components/forms/JobModal'
import { isAdmin } from '@/lib/auth/is-admin'
import { listJobTemplatesQueryOptions } from '@/lib/job-templates/query-options'
import { listWorkspacesQueryOptions, orgTimezoneQueryOptions } from '@/lib/workspaces/query-options'
import { z } from '@/shared/schemas/openapi'

const workspacesOptions = listWorkspacesQueryOptions(false)

export const Route = createFileRoute('/_authenticated/jobs/new')({
  validateSearch: z.object({ from: z.string().optional() }),
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(workspacesOptions),
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
  const { data: workspaces } = useSuspenseQuery(workspacesOptions)
  return (
    <JobModal
      variant="create"
      workspaces={workspaces}
      initialTemplateId={search.from}
      isAdmin={isAdmin(currentUser)}
      onClose={() => navigate({ to: '/jobs' })}
    />
  )
}
