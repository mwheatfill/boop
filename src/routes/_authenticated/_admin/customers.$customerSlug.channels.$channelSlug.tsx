import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, Link, Outlet, useNavigate } from '@tanstack/react-router'
import { ArrowLeft, Pencil, SendHorizonal } from 'lucide-react'
import { toast } from 'sonner'
import { useShortcut } from '@/components/keyboard/use-shortcut'
import { StatusBadge } from '@/components/StatusBadge'
import { Button } from '@/components/ui/button'
import { channelQueryOptions } from '@/lib/channels/query-options'
import { archiveChannelFn, restoreChannelFn, sendTestAlertFn } from '@/lib/channels/server-fns'
import type { Channel } from '@/shared/schemas/channel'

function testStatusToneClass(status: Channel['lastTestAlertStatus']): string {
  if (status === 'delivered') return 'text-success'
  if (status === 'failed') return 'text-destructive'
  return 'text-warning'
}

export const Route = createFileRoute(
  '/_authenticated/_admin/customers/$customerSlug/channels/$channelSlug',
)({
  loader: async ({ context, params }) => {
    await context.queryClient.ensureQueryData(
      channelQueryOptions(params.customerSlug, params.channelSlug),
    )
  },
  component: ChannelDetailPage,
})

function ChannelDetailPage() {
  const { customerSlug, channelSlug } = Route.useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: channel } = useSuspenseQuery(channelQueryOptions(customerSlug, channelSlug))

  const archive = useMutation({
    mutationFn: () => archiveChannelFn({ data: { customerSlug, channelSlug } }),
    onSuccess: async (result) => {
      if (!result.ok) {
        toast.error(result.message ?? 'Cannot archive')
        return
      }
      toast.success('Archived')
      await queryClient.invalidateQueries({ queryKey: ['customers', customerSlug, 'channels'] })
      await navigate({ to: '/customers/$customerSlug/channels', params: { customerSlug } })
    },
  })

  const restore = useMutation({
    mutationFn: () => restoreChannelFn({ data: { customerSlug, channelSlug } }),
    onSuccess: async () => {
      toast.success('Restored')
      await queryClient.invalidateQueries({ queryKey: ['customers', customerSlug, 'channels'] })
    },
  })

  const sendTest = useMutation({
    mutationFn: () => sendTestAlertFn({ data: { customerSlug, channelSlug } }),
    onSuccess: async (result) => {
      if (!result.ok) {
        toast.error(result.message ?? 'Could not queue test alert')
        return
      }
      toast.message('Test alert queued — watch for status below.')
      await queryClient.invalidateQueries({
        queryKey: ['customers', customerSlug, 'channels', channelSlug],
      })
    },
  })

  useShortcut(
    'e',
    () =>
      void navigate({
        to: '/customers/$customerSlug/channels/$channelSlug/edit',
        params: { customerSlug, channelSlug },
      }),
    { description: 'Edit Channel', section: 'page' },
  )

  useShortcut('t', () => sendTest.mutate(), {
    description: 'Send test alert',
    section: 'page',
    disabled: channel.status !== 'active' || sendTest.isPending,
  })

  return (
    <div className="flex flex-col gap-6">
      <Link
        to="/customers/$customerSlug/channels"
        params={{ customerSlug }}
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3" aria-hidden /> Channels
      </Link>
      <header className="flex items-start justify-between">
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Channel · {channel.kind}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">{channel.name}</h1>
          <p className="text-sm text-muted-foreground">
            <span className="font-mono">{channel.slug}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={channel.status} />
          <Button
            size="sm"
            variant="outline"
            disabled={channel.status !== 'active' || sendTest.isPending}
            onClick={() => sendTest.mutate()}
          >
            <SendHorizonal aria-hidden /> Send test alert
          </Button>
          {channel.status === 'active' ? (
            <Button
              size="sm"
              variant="outline"
              render={
                <Link
                  to="/customers/$customerSlug/channels/$channelSlug/edit"
                  params={{ customerSlug, channelSlug }}
                />
              }
            >
              <Pencil aria-hidden /> Edit
            </Button>
          ) : null}
          {channel.status === 'active' ? (
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
        <h2 className="text-sm font-medium">Last test alert</h2>
        {channel.lastTestAlertAt ? (
          <p className="text-sm text-muted-foreground">
            {new Date(channel.lastTestAlertAt).toLocaleString()} ·{' '}
            <span className={testStatusToneClass(channel.lastTestAlertStatus)}>
              {channel.lastTestAlertStatus ?? 'pending'}
            </span>
            {channel.lastTestAlertReason ? ` — ${channel.lastTestAlertReason}` : null}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">No test alert sent yet.</p>
        )}
      </section>

      <section className="flex flex-col gap-2 rounded-md border border-border bg-muted/20 p-4">
        <h2 className="text-sm font-medium">Config</h2>
        <pre className="overflow-x-auto rounded bg-card p-3 font-mono text-xs">
          {JSON.stringify(channel.config, null, 2)}
        </pre>
      </section>
      <Outlet />
    </div>
  )
}
