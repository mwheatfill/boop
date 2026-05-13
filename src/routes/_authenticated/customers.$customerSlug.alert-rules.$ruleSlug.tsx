import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, Link, Outlet, useNavigate } from '@tanstack/react-router'
import { ArrowLeft, Pencil } from 'lucide-react'
import { toast } from 'sonner'
import { AlertRuleDetailView } from '@/components/alerts/AlertRuleDetailView'
import { useShortcut } from '@/components/keyboard/use-shortcut'
import { Button } from '@/components/ui/button'
import { alertRuleQueryOptions } from '@/lib/alert-rules/query-options'
import { archiveAlertRuleFn, restoreAlertRuleFn } from '@/lib/alert-rules/server-fns'
import { listChannelsQueryOptions } from '@/lib/channels/query-options'

export const Route = createFileRoute(
  '/_authenticated/customers/$customerSlug/alert-rules/$ruleSlug',
)({
  loader: async ({ context, params }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(
        alertRuleQueryOptions(params.customerSlug, params.ruleSlug),
      ),
      context.queryClient.ensureQueryData(listChannelsQueryOptions(params.customerSlug, true)),
    ])
  },
  component: AlertRuleDetailPage,
})

function AlertRuleDetailPage() {
  const { customerSlug, ruleSlug } = Route.useParams()
  const goTo = useNavigate()
  const queryClient = useQueryClient()
  const { data: rule } = useSuspenseQuery(alertRuleQueryOptions(customerSlug, ruleSlug))
  const { data: channels } = useSuspenseQuery(listChannelsQueryOptions(customerSlug, true))
  const channelById = new Map(channels.map((c) => [c.id, c]))

  const archive = useMutation({
    mutationFn: () => archiveAlertRuleFn({ data: { customerSlug, ruleSlug } }),
    onSuccess: async () => {
      toast.success('Archived')
      await queryClient.invalidateQueries({ queryKey: ['customers', customerSlug, 'alert-rules'] })
      await goTo({ to: '/customers/$customerSlug/alert-rules', params: { customerSlug } })
    },
  })

  const restore = useMutation({
    mutationFn: () => restoreAlertRuleFn({ data: { customerSlug, ruleSlug } }),
    onSuccess: async () => {
      toast.success('Restored')
      await queryClient.invalidateQueries({ queryKey: ['customers', customerSlug, 'alert-rules'] })
    },
  })

  useShortcut(
    'e',
    () =>
      void goTo({
        to: '/customers/$customerSlug/alert-rules/$ruleSlug/edit',
        params: { customerSlug, ruleSlug },
      }),
    { description: 'Edit Alert Rule', section: 'page' },
  )

  return (
    <>
      <AlertRuleDetailView
        rule={rule}
        eyebrow="Alert Rule"
        channelById={channelById}
        backLink={
          <Link
            to="/customers/$customerSlug/alert-rules"
            params={{ customerSlug }}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3" aria-hidden /> Alert Rules
          </Link>
        }
        editButton={
          <Button
            size="sm"
            variant="outline"
            render={
              <Link
                to="/customers/$customerSlug/alert-rules/$ruleSlug/edit"
                params={{ customerSlug, ruleSlug }}
              />
            }
          >
            <Pencil aria-hidden /> Edit
          </Button>
        }
        archive={{ onClick: () => archive.mutate(), isPending: archive.isPending }}
        restore={{ onClick: () => restore.mutate(), isPending: restore.isPending }}
      />
      <Outlet />
    </>
  )
}
