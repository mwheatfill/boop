import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { ArrowLeft, Pencil } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { AlertRuleDetailView } from '@/components/alerts/AlertRuleDetailView'
import { AlertRuleSheet } from '@/components/forms/AlertRuleSheet'
import { useShortcut } from '@/components/keyboard/use-shortcut'
import { Button } from '@/components/ui/button'
import { alertRuleQueryOptions } from '@/lib/alert-rules/query-options'
import { archiveAlertRuleFn, restoreAlertRuleFn } from '@/lib/alert-rules/server-fns'
import { listChannelsQueryOptions } from '@/lib/channels/query-options'

export const Route = createFileRoute('/_authenticated/alert-rules/$ruleSlug')({
  loader: async ({ context, params }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(
        alertRuleQueryOptions(context.workspaceSlug, params.ruleSlug),
      ),
      context.queryClient.ensureQueryData(listChannelsQueryOptions(context.workspaceSlug, true)),
    ])
  },
  component: AlertRuleDetailPage,
})

function AlertRuleDetailPage() {
  const { ruleSlug } = Route.useParams()
  const { workspaceSlug, currentUser } = Route.useRouteContext()
  const goTo = useNavigate()
  const queryClient = useQueryClient()
  const [editOpen, setEditOpen] = useState(false)
  const { data: rule } = useSuspenseQuery(alertRuleQueryOptions(workspaceSlug, ruleSlug))
  const { data: channels } = useSuspenseQuery(listChannelsQueryOptions(workspaceSlug, true))
  const channelById = new Map(channels.map((c) => [c.id, c]))

  const archive = useMutation({
    mutationFn: () => archiveAlertRuleFn({ data: { workspaceSlug, ruleSlug } }),
    onSuccess: async () => {
      toast.success('Alert rule deleted', { description: 'Find it in the Recycle Bin.' })
      await queryClient.invalidateQueries({
        queryKey: ['workspaces', workspaceSlug, 'alert-rules'],
      })
      await goTo({ to: '/alert-rules' })
    },
  })

  const restore = useMutation({
    mutationFn: () => restoreAlertRuleFn({ data: { workspaceSlug, ruleSlug } }),
    onSuccess: async () => {
      toast.success('Restored')
      await queryClient.invalidateQueries({
        queryKey: ['workspaces', workspaceSlug, 'alert-rules'],
      })
    },
  })

  useShortcut('e', () => setEditOpen(true), {
    description: 'Edit Alert Rule',
    section: 'page',
  })

  return (
    <AlertRuleDetailView
      rule={rule}
      eyebrow="Alert Rule"
      channelById={channelById}
      backLink={
        <Link
          to="/alert-rules"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3" aria-hidden /> Alert Rules
        </Link>
      }
      editButton={
        <AlertRuleSheet
          owner={{ workspaceSlug }}
          rule={rule}
          isAdmin={currentUser.role === 'admin'}
          open={editOpen}
          onOpenChange={setEditOpen}
          trigger={
            <Button size="sm" variant="outline">
              <Pencil aria-hidden /> Edit
            </Button>
          }
        />
      }
      archive={{ onClick: () => archive.mutate(), isPending: archive.isPending }}
      restore={{ onClick: () => restore.mutate(), isPending: restore.isPending }}
    />
  )
}
