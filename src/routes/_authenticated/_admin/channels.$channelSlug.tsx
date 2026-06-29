import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { ArrowLeft, Pencil } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { ChannelDetailView } from '@/components/channels/ChannelDetailView'
import { ChannelSheet } from '@/components/forms/ChannelSheet'
import { useShortcut } from '@/components/keyboard/use-shortcut'
import { Button } from '@/components/ui/button'
import { channelQueryOptions } from '@/lib/channels/query-options'
import { archiveChannelFn, restoreChannelFn, sendTestAlertFn } from '@/lib/channels/server-fns'

export const Route = createFileRoute('/_authenticated/_admin/channels/$channelSlug')({
  loader: async ({ context, params }) => {
    await context.queryClient.ensureQueryData(
      channelQueryOptions(context.workspaceSlug, params.channelSlug),
    )
  },
  component: ChannelDetailPage,
})

function ChannelDetailPage() {
  const { channelSlug } = Route.useParams()
  const { workspaceSlug } = Route.useRouteContext()
  const goTo = useNavigate()
  const queryClient = useQueryClient()
  const [editOpen, setEditOpen] = useState(false)
  const { data: channel } = useSuspenseQuery(channelQueryOptions(workspaceSlug, channelSlug))

  const archive = useMutation({
    mutationFn: () => archiveChannelFn({ data: { workspaceSlug, channelSlug } }),
    onSuccess: async (result) => {
      if (!result.ok) {
        toast.error(result.message ?? 'Cannot archive')
        return
      }
      toast.success('Archived')
      await queryClient.invalidateQueries({ queryKey: ['workspaces', workspaceSlug, 'channels'] })
      await goTo({ to: '/channels' })
    },
  })

  const restore = useMutation({
    mutationFn: () => restoreChannelFn({ data: { workspaceSlug, channelSlug } }),
    onSuccess: async () => {
      toast.success('Restored')
      await queryClient.invalidateQueries({ queryKey: ['workspaces', workspaceSlug, 'channels'] })
    },
  })

  const sendTest = useMutation({
    mutationFn: () => sendTestAlertFn({ data: { workspaceSlug, channelSlug } }),
    onSuccess: async (result) => {
      if (!result.ok) {
        toast.error(result.message ?? 'Could not queue test alert')
        return
      }
      toast.message('Test alert queued, watch for status below.')
      await queryClient.invalidateQueries({
        queryKey: ['workspaces', workspaceSlug, 'channels', channelSlug],
      })
    },
  })

  useShortcut('e', () => setEditOpen(true), { description: 'Edit Channel', section: 'page' })

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
            to="/channels"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3" aria-hidden /> Channels
          </Link>
        }
        editButton={
          <ChannelSheet
            owner={{ workspaceSlug }}
            channel={channel}
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
        sendTest={{ onClick: () => sendTest.mutate(), isPending: sendTest.isPending }}
      />
    </>
  )
}
