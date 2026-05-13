import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { ChannelModal } from '@/components/forms/ChannelModal'
import { channelQueryOptions } from '@/lib/channels/query-options'

export const Route = createFileRoute(
  '/_authenticated/_admin/customers/$customerSlug/channels/$channelSlug/edit',
)({
  loader: async ({ context, params }) => {
    await context.queryClient.ensureQueryData(
      channelQueryOptions(params.customerSlug, params.channelSlug),
    )
  },
  component: EditChannelPage,
})

function EditChannelPage() {
  const { customerSlug, channelSlug } = Route.useParams()
  const navigate = Route.useNavigate()
  const { data: channel } = useSuspenseQuery(channelQueryOptions(customerSlug, channelSlug))
  return (
    <ChannelModal
      variant="edit"
      owner={{ scope: 'customer', customerSlug }}
      initialChannel={channel}
      onClose={() =>
        navigate({
          to: '/customers/$customerSlug/channels/$channelSlug',
          params: { customerSlug, channelSlug },
        })
      }
    />
  )
}
