import { createFileRoute } from '@tanstack/react-router'
import { AlertRuleModal } from '@/components/forms/AlertRuleModal'

export const Route = createFileRoute('/_authenticated/_admin/alert-rules/new')({
  component: NewWorkspaceAlertRulePage,
})

function NewWorkspaceAlertRulePage() {
  const navigate = Route.useNavigate()
  return (
    <AlertRuleModal
      variant="create"
      owner={{ scope: 'workspace' }}
      isAdmin
      onClose={() => navigate({ to: '/alert-rules' })}
    />
  )
}
