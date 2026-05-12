import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { AlertRuleModal } from '@/components/forms/AlertRuleModal'
import { alertRuleQueryOptions } from '@/lib/alert-rules/query-options'
import { isAdmin } from '@/lib/auth/is-admin'

export const Route = createFileRoute(
  '/_authenticated/customers/$customerSlug/alert-rules/$ruleSlug/edit',
)({
  loader: async ({ context, params }) => {
    await context.queryClient.ensureQueryData(
      alertRuleQueryOptions(params.customerSlug, params.ruleSlug),
    )
  },
  component: EditAlertRulePage,
})

function EditAlertRulePage() {
  const { customerSlug, ruleSlug } = Route.useParams()
  const navigate = Route.useNavigate()
  const { currentUser } = Route.useRouteContext()
  const { data: rule } = useSuspenseQuery(alertRuleQueryOptions(customerSlug, ruleSlug))
  return (
    <AlertRuleModal
      variant="edit"
      customerSlug={customerSlug}
      initialRule={rule}
      isAdmin={isAdmin(currentUser)}
      onClose={() =>
        navigate({
          to: '/customers/$customerSlug/alert-rules/$ruleSlug',
          params: { customerSlug, ruleSlug },
        })
      }
    />
  )
}
