import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, Link, Outlet, useNavigate } from '@tanstack/react-router'
import { ArrowLeft, Pencil } from 'lucide-react'
import { toast } from 'sonner'
import { ChannelDetailView } from '@/components/channels/ChannelDetailView'
import { useShortcut } from '@/components/keyboard/use-shortcut'
import { Button } from '@/components/ui/button'
import { channelQueryOptions } from '@/lib/channels/query-options'
import { archiveChannelFn, restoreChannelFn, sendTestAlertFn } from '@/lib/channels/server-fns'

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
    <>
      <ChannelDetailView
        channel={channel}
        eyebrow={`Channel · ${channel.kind}`}
        backLink={
          <Link
            to="/customers/$customerSlug/channels"
            params={{ customerSlug }}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3" aria-hidden /> Channels
          </Link>
        }
        editButton={
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
        }
        archive={{ onClick: () => archive.mutate(), isPending: archive.isPending }}
        restore={{ onClick: () => restore.mutate(), isPending: restore.isPending }}
        sendTest={{ onClick: () => sendTest.mutate(), isPending: sendTest.isPending }}
      />
      <Outlet />
    </>
  )
}
