import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { TargetModal } from '@/components/forms/TargetModal'

export const Route = createFileRoute('/_authenticated/_admin/customers/$customerSlug/targets/new')({
  component: NewTargetRoute,
})

function NewTargetRoute() {
  const { customerSlug } = Route.useParams()
  const navigate = useNavigate()
  return (
    <TargetModal
      variant="create"
      customerSlug={customerSlug}
      onClose={() => navigate({ to: '/customers/$customerSlug', params: { customerSlug } })}
    />
  )
}
