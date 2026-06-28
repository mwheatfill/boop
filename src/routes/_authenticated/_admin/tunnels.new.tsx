import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { TunnelModal } from '@/components/forms/TunnelModal'

export const Route = createFileRoute('/_authenticated/_admin/tunnels/new')({
  component: NewTunnelRoute,
})

function NewTunnelRoute() {
  const navigate = useNavigate()
  return <TunnelModal onClose={() => navigate({ to: '/tunnels' })} />
}
