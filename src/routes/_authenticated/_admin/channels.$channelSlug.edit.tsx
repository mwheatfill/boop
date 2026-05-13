import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { ChannelModal } from '@/components/forms/ChannelModal'
import { workspaceChannelQueryOptions } from '@/lib/channels/query-options'

export const Route = createFileRoute('/_authenticated/_admin/channels/$channelSlug/edit')({
  loader: async ({ context, params }) => {
    await context.queryClient.ensureQueryData(workspaceChannelQueryOptions(params.channelSlug))
  },
  component: EditWorkspaceChannelPage,
})

function EditWorkspaceChannelPage() {
  const { channelSlug } = Route.useParams()
  const navigate = Route.useNavigate()
  const { data: channel } = useSuspenseQuery(workspaceChannelQueryOptions(channelSlug))
  return (
    <ChannelModal
      variant="edit"
      owner={{ scope: 'workspace' }}
      initialChannel={channel}
      onClose={() => navigate({ to: '/channels/$channelSlug', params: { channelSlug } })}
    />
  )
}
