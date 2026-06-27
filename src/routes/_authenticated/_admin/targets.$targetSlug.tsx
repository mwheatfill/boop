import { queryOptions, useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { TargetModal } from '@/components/forms/TargetModal'
import { getTargetFn } from '@/lib/targets/server-fns'

const targetQueryOptions = (workspaceSlug: string, targetSlug: string) =>
  queryOptions({
    queryKey: ['workspaces', workspaceSlug, 'targets', targetSlug],
    queryFn: () => getTargetFn({ data: { workspaceSlug, targetSlug } }),
  })

export const Route = createFileRoute('/_authenticated/_admin/targets/$targetSlug')({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(
      targetQueryOptions(context.workspaceSlug, params.targetSlug),
    ),
  component: EditTargetRoute,
})

function EditTargetRoute() {
  const { targetSlug } = Route.useParams()
  const { workspaceSlug } = Route.useRouteContext()
  const navigate = useNavigate()
  const { data: target } = useSuspenseQuery(targetQueryOptions(workspaceSlug, targetSlug))
  return (
    <TargetModal
      variant="edit"
      workspaceSlug={workspaceSlug}
      initialTarget={target}
      onClose={() => navigate({ to: '/targets' })}
    />
  )
}
