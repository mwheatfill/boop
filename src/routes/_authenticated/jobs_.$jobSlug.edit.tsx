import { queryOptions, useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { JobModal } from '@/components/forms/JobModal'
import { isAdmin } from '@/lib/auth/is-admin'
import { getJobFn } from '@/lib/jobs/server-fns'
import { listTargetsForWorkspaceFn } from '@/lib/targets/server-fns'
import { listWorkspacesFn } from '@/lib/workspaces/server-fns'

const jobOptions = (workspaceSlug: string, jobSlug: string) =>
  queryOptions({
    queryKey: ['workspaces', workspaceSlug, 'jobs', jobSlug],
    queryFn: () => getJobFn({ data: { workspaceSlug, jobSlug } }),
  })

const workspacesOptions = queryOptions({
  queryKey: ['workspaces', { includeArchived: false }],
  queryFn: () => listWorkspacesFn({ data: { includeArchived: false } }),
})

const targetsOptions = (workspaceSlug: string) =>
  queryOptions({
    queryKey: ['workspaces', workspaceSlug, 'targets', { includeArchived: false }],
    queryFn: () => listTargetsForWorkspaceFn({ data: { workspaceSlug, includeArchived: false } }),
  })

export const Route = createFileRoute('/_authenticated/jobs_/$jobSlug/edit')({
  loader: ({ context, params }) =>
    Promise.all([
      context.queryClient.ensureQueryData(jobOptions(context.workspaceSlug, params.jobSlug)),
      context.queryClient.ensureQueryData(workspacesOptions),
      context.queryClient.ensureQueryData(targetsOptions(context.workspaceSlug)),
    ]),
  component: EditJobRoute,
})

function EditJobRoute() {
  const { jobSlug } = Route.useParams()
  const navigate = useNavigate()
  const { currentUser, workspaceSlug } = Route.useRouteContext()
  const { data: job } = useSuspenseQuery(jobOptions(workspaceSlug, jobSlug))
  const { data: workspaces } = useSuspenseQuery(workspacesOptions)
  const { data: targets } = useSuspenseQuery(targetsOptions(workspaceSlug))

  return (
    <JobModal
      variant="edit"
      initialJob={job}
      workspaces={workspaces}
      initialTargets={targets}
      isAdmin={isAdmin(currentUser)}
      onClose={() => navigate({ to: '/jobs/$jobSlug', params: { jobSlug } })}
    />
  )
}
