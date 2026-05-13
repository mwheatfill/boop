import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, Link, Outlet, useNavigate } from '@tanstack/react-router'
import { ArrowLeft, Pencil } from 'lucide-react'
import { toast } from 'sonner'
import { useShortcut } from '@/components/keyboard/use-shortcut'
import { StatusBadge } from '@/components/StatusBadge'
import { Button } from '@/components/ui/button'
import { workspaceAlertRuleQueryOptions } from '@/lib/alert-rules/query-options'
import {
  archiveWorkspaceAlertRuleFn,
  restoreWorkspaceAlertRuleFn,
} from '@/lib/alert-rules/server-fns'
import { workspaceChannelsQueryOptions } from '@/lib/channels/query-options'
import { summarizeRuleConfig } from '@/shared/schemas/alert-rule'

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
    <div className="flex flex-col gap-6">
      <Link
        to="/alert-rules"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3" aria-hidden /> Alert Rules
      </Link>
      <header className="flex items-start justify-between">
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Alert Rule · workspace
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">{rule.name}</h1>
          <p className="text-sm text-muted-foreground">
            <span className="font-mono">{rule.slug}</span> · {summarizeRuleConfig(rule.config)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={rule.status} />
          {rule.status === 'active' ? (
            <Button
              size="sm"
              variant="outline"
              render={<Link to="/alert-rules/$ruleSlug/edit" params={{ ruleSlug }} />}
            >
              <Pencil aria-hidden /> Edit
            </Button>
          ) : null}
          {rule.status === 'active' ? (
            <Button
              size="sm"
              variant="outline"
              disabled={archive.isPending}
              onClick={() => archive.mutate()}
            >
              Archive
            </Button>
          ) : (
            <Button size="sm" disabled={restore.isPending} onClick={() => restore.mutate()}>
              Restore
            </Button>
          )}
        </div>
      </header>

      <section className="flex flex-col gap-2 rounded-md border border-border bg-muted/20 p-4">
        <h2 className="text-sm font-medium">Routes to</h2>
        <ul className="flex flex-col gap-1 text-sm">
          {rule.channelIds.map((id) => {
            const channel = channelById.get(id)
            return (
              <li key={id} className="flex items-center gap-2">
                <span className="text-foreground">{channel?.name ?? id}</span>
                {channel && channel.status !== 'active' ? (
                  <span className="text-xs text-warning">(archived — update routing)</span>
                ) : null}
              </li>
            )
          })}
        </ul>
      </section>

      <section className="flex flex-col gap-2 rounded-md border border-border bg-muted/20 p-4">
        <h2 className="text-sm font-medium">Last fired</h2>
        <p className="text-sm text-muted-foreground">
          {rule.lastFiredAt ? new Date(rule.lastFiredAt).toLocaleString() : 'Never fired yet.'}
        </p>
      </section>
      <Outlet />
    </div>
  )
}
