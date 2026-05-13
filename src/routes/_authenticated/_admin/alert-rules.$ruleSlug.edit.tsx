import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { AlertRuleModal } from '@/components/forms/AlertRuleModal'
import { workspaceAlertRuleQueryOptions } from '@/lib/alert-rules/query-options'

export const Route = createFileRoute('/_authenticated/_admin/alert-rules/$ruleSlug/edit')({
  loader: async ({ context, params }) => {
    await context.queryClient.ensureQueryData(workspaceAlertRuleQueryOptions(params.ruleSlug))
  },
  component: EditWorkspaceAlertRulePage,
})

function EditWorkspaceAlertRulePage() {
  const { ruleSlug } = Route.useParams()
  const navigate = Route.useNavigate()
  const { data: rule } = useSuspenseQuery(workspaceAlertRuleQueryOptions(ruleSlug))
  return (
    <AlertRuleModal
      variant="edit"
      owner={{ scope: 'workspace' }}
      initialRule={rule}
      isAdmin
      onClose={() => navigate({ to: '/alert-rules/$ruleSlug', params: { ruleSlug } })}
    />
  )
}
