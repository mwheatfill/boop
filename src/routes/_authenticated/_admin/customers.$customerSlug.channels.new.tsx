import { createFileRoute } from '@tanstack/react-router'
import { ChannelModal } from '@/components/forms/ChannelModal'

export const Route = createFileRoute('/_authenticated/_admin/customers/$customerSlug/channels/new')(
  {
    component: NewChannelPage,
  },
)

function NewChannelPage() {
  const { customerSlug } = Route.useParams()
  const navigate = Route.useNavigate()
  return (
    <ChannelModal
      variant="create"
      owner={{ scope: 'customer', customerSlug }}
      onClose={() =>
        navigate({ to: '/customers/$customerSlug/channels', params: { customerSlug } })
      }
    />
  )
}
