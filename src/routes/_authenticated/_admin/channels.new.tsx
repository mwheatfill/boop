import { createFileRoute } from '@tanstack/react-router'
import { ChannelModal } from '@/components/forms/ChannelModal'

export const Route = createFileRoute('/_authenticated/_admin/channels/new')({
  component: NewChannelPage,
})

function NewChannelPage() {
  const { workspaceSlug } = Route.useRouteContext()
  const navigate = Route.useNavigate()
  return (
    <ChannelModal
      variant="create"
      owner={{ workspaceSlug }}
      onClose={() => navigate({ to: '/channels' })}
    />
  )
}
