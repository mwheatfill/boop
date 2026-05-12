import { createFileRoute } from '@tanstack/react-router'
import { AlertRuleModal } from '@/components/forms/AlertRuleModal'

export const Route = createFileRoute('/_authenticated/customers/$customerSlug/alert-rules/new')({
  component: NewAlertRulePage,
})

function NewAlertRulePage() {
  const { customerSlug } = Route.useParams()
  const navigate = Route.useNavigate()
  return (
    <AlertRuleModal
      variant="create"
      customerSlug={customerSlug}
      onClose={() =>
        navigate({ to: '/customers/$customerSlug/alert-rules', params: { customerSlug } })
      }
    />
  )
}
