import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { TargetModal } from '@/components/forms/TargetModal'

export const Route = createFileRoute('/_authenticated/_admin/targets/new')({
  component: NewTargetRoute,
})

function NewTargetRoute() {
  const { workspaceSlug } = Route.useRouteContext()
  const navigate = useNavigate()
  return (
    <TargetModal
      variant="create"
      workspaceSlug={workspaceSlug}
      onClose={() => navigate({ to: '/targets' })}
    />
  )
}
