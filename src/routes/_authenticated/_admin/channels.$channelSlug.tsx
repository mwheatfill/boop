import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, Link, Outlet, useNavigate } from '@tanstack/react-router'
import { ArrowLeft, Pencil } from 'lucide-react'
import { toast } from 'sonner'
import { ChannelDetailView } from '@/components/channels/ChannelDetailView'
import { useShortcut } from '@/components/keyboard/use-shortcut'
import { Button } from '@/components/ui/button'
import { workspaceChannelQueryOptions } from '@/lib/channels/query-options'
import {
  archiveWorkspaceChannelFn,
  restoreWorkspaceChannelFn,
  sendWorkspaceTestAlertFn,
} from '@/lib/channels/server-fns'

export const Route = createFileRoute('/_authenticated/_admin/channels/$channelSlug')({
  loader: async ({ context, params }) => {
    await context.queryClient.ensureQueryData(workspaceChannelQueryOptions(params.channelSlug))
  },
  component: WorkspaceChannelDetailPage,
})

function WorkspaceChannelDetailPage() {
  const { channelSlug } = Route.useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: channel } = useSuspenseQuery(workspaceChannelQueryOptions(channelSlug))

  const archive = useMutation({
    mutationFn: () => archiveWorkspaceChannelFn({ data: { channelSlug } }),
    onSuccess: async (result) => {
      if (!result.ok) {
        toast.error(result.message ?? 'Cannot archive')
        return
      }
      toast.success('Archived')
      await queryClient.invalidateQueries({ queryKey: ['workspace', 'channels'] })
      await navigate({ to: '/channels' })
    },
  })

  const restore = useMutation({
    mutationFn: () => restoreWorkspaceChannelFn({ data: { channelSlug } }),
    onSuccess: async () => {
      toast.success('Restored')
      await queryClient.invalidateQueries({ queryKey: ['workspace', 'channels'] })
    },
  })

  const sendTest = useMutation({
    mutationFn: () => sendWorkspaceTestAlertFn({ data: { channelSlug } }),
    onSuccess: async (result) => {
      if (!result.ok) {
        toast.error(result.message ?? 'Could not queue test alert')
        return
      }
      toast.message('Test alert queued — watch for status below.')
      await queryClient.invalidateQueries({ queryKey: ['workspace', 'channels', channelSlug] })
    },
  })

  useShortcut(
    'e',
    () => void navigate({ to: '/channels/$channelSlug/edit', params: { channelSlug } }),
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
        eyebrow={`Channel · workspace · ${channel.kind}`}
        backLink={
          <Link
            to="/channels"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3" aria-hidden /> Channels
          </Link>
        }
        editButton={
          <Button
            size="sm"
            variant="outline"
            render={<Link to="/channels/$channelSlug/edit" params={{ channelSlug }} />}
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
