import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { ChannelModal } from '@/components/forms/ChannelModal'
import { channelQueryOptions } from '@/lib/channels/query-options'

export const Route = createFileRoute('/_authenticated/_admin/channels/$channelSlug/edit')({
  loader: async ({ context, params }) => {
    await context.queryClient.ensureQueryData(
      channelQueryOptions(context.workspaceSlug, params.channelSlug),
    )
  },
  component: EditChannelPage,
})

function EditChannelPage() {
  const { channelSlug } = Route.useParams()
  const { workspaceSlug } = Route.useRouteContext()
  const navigate = Route.useNavigate()
  const { data: channel } = useSuspenseQuery(channelQueryOptions(workspaceSlug, channelSlug))
  return (
    <ChannelModal
      variant="edit"
      owner={{ workspaceSlug }}
      initialChannel={channel}
      onClose={() => navigate({ to: '/channels/$channelSlug', params: { channelSlug } })}
    />
  )
}
