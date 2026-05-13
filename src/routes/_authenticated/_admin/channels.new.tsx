import { createFileRoute } from '@tanstack/react-router'
import { ChannelModal } from '@/components/forms/ChannelModal'

export const Route = createFileRoute('/_authenticated/_admin/channels/new')({
  component: NewWorkspaceChannelPage,
})

function NewWorkspaceChannelPage() {
  const navigate = Route.useNavigate()
  return (
    <ChannelModal
      variant="create"
      owner={{ scope: 'workspace' }}
      onClose={() => navigate({ to: '/channels' })}
    />
  )
}
