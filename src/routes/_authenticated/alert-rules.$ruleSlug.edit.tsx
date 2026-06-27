import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { AlertRuleModal } from '@/components/forms/AlertRuleModal'
import { alertRuleQueryOptions } from '@/lib/alert-rules/query-options'
import { isAdmin } from '@/lib/auth/is-admin'

export const Route = createFileRoute('/_authenticated/alert-rules/$ruleSlug/edit')({
  loader: async ({ context, params }) => {
    await context.queryClient.ensureQueryData(
      alertRuleQueryOptions(context.workspaceSlug, params.ruleSlug),
    )
  },
  component: EditAlertRulePage,
})

function EditAlertRulePage() {
  const { ruleSlug } = Route.useParams()
  const navigate = Route.useNavigate()
  const { currentUser, workspaceSlug } = Route.useRouteContext()
  const { data: rule } = useSuspenseQuery(alertRuleQueryOptions(workspaceSlug, ruleSlug))
  return (
    <AlertRuleModal
      variant="edit"
      owner={{ workspaceSlug }}
      initialRule={rule}
      isAdmin={isAdmin(currentUser)}
      onClose={() => navigate({ to: '/alert-rules/$ruleSlug', params: { ruleSlug } })}
    />
  )
}
