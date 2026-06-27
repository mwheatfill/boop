import { createFileRoute } from '@tanstack/react-router'
import { AlertRuleModal } from '@/components/forms/AlertRuleModal'
import { isAdmin } from '@/lib/auth/is-admin'

export const Route = createFileRoute('/_authenticated/alert-rules/new')({
  component: NewAlertRulePage,
})

function NewAlertRulePage() {
  const navigate = Route.useNavigate()
  const { currentUser, workspaceSlug } = Route.useRouteContext()
  return (
    <AlertRuleModal
      variant="create"
      owner={{ workspaceSlug }}
      isAdmin={isAdmin(currentUser)}
      onClose={() => navigate({ to: '/alert-rules' })}
    />
  )
}
