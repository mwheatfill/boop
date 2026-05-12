import { createFileRoute } from '@tanstack/react-router'
import { AlertRuleModal } from '@/components/forms/AlertRuleModal'
import { isAdmin } from '@/lib/auth/is-admin'

export const Route = createFileRoute('/_authenticated/customers/$customerSlug/alert-rules/new')({
  component: NewAlertRulePage,
})

function NewAlertRulePage() {
  const { customerSlug } = Route.useParams()
  const navigate = Route.useNavigate()
  const { currentUser } = Route.useRouteContext()
  return (
    <AlertRuleModal
      variant="create"
      customerSlug={customerSlug}
      isAdmin={isAdmin(currentUser)}
      onClose={() =>
        navigate({ to: '/customers/$customerSlug/alert-rules', params: { customerSlug } })
      }
    />
  )
}
