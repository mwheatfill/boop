import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, Link, Outlet, useNavigate } from '@tanstack/react-router'
import { ArrowLeft, Pencil } from 'lucide-react'
import { toast } from 'sonner'
import { AlertRuleDetailView } from '@/components/alerts/AlertRuleDetailView'
import { useShortcut } from '@/components/keyboard/use-shortcut'
import { Button } from '@/components/ui/button'
import { workspaceAlertRuleQueryOptions } from '@/lib/alert-rules/query-options'
import {
  archiveWorkspaceAlertRuleFn,
  restoreWorkspaceAlertRuleFn,
} from '@/lib/alert-rules/server-fns'
import { workspaceChannelsQueryOptions } from '@/lib/channels/query-options'

export const Route = createFileRoute('/_authenticated/_admin/alert-rules/$ruleSlug')({
  loader: async ({ context, params }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(workspaceAlertRuleQueryOptions(params.ruleSlug)),
      context.queryClient.ensureQueryData(workspaceChannelsQueryOptions(true)),
    ])
  },
  component: WorkspaceAlertRuleDetailPage,
})

function WorkspaceAlertRuleDetailPage() {
  const { ruleSlug } = Route.useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: rule } = useSuspenseQuery(workspaceAlertRuleQueryOptions(ruleSlug))
  const { data: channels } = useSuspenseQuery(workspaceChannelsQueryOptions(true))
  const channelById = new Map(channels.map((c) => [c.id, c]))

  const archive = useMutation({
    mutationFn: () => archiveWorkspaceAlertRuleFn({ data: { ruleSlug } }),
    onSuccess: async () => {
      toast.success('Archived')
      await queryClient.invalidateQueries({ queryKey: ['workspace', 'alert-rules'] })
      await navigate({ to: '/alert-rules' })
    },
  })

  const restore = useMutation({
    mutationFn: () => restoreWorkspaceAlertRuleFn({ data: { ruleSlug } }),
    onSuccess: async () => {
      toast.success('Restored')
      await queryClient.invalidateQueries({ queryKey: ['workspace', 'alert-rules'] })
    },
  })

  useShortcut(
    'e',
    () => void navigate({ to: '/alert-rules/$ruleSlug/edit', params: { ruleSlug } }),
    { description: 'Edit Alert Rule', section: 'page' },
  )

  return (
    <>
      <AlertRuleDetailView
        rule={rule}
        eyebrow="Alert Rule · workspace"
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
          <Button
            size="sm"
            variant="outline"
            render={<Link to="/alert-rules/$ruleSlug/edit" params={{ ruleSlug }} />}
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
