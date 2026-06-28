import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { TunnelEditModal } from '@/components/forms/TunnelEditModal'
import { tunnelQueryOptions } from '@/lib/tunnels/query-options'

export const Route = createFileRoute('/_authenticated/_admin/tunnels/$tunnelSlug')({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(tunnelQueryOptions(params.tunnelSlug)),
  component: EditTunnelRoute,
})

function EditTunnelRoute() {
  const { tunnelSlug } = Route.useParams()
  const navigate = useNavigate()
  const { data: tunnel } = useSuspenseQuery(tunnelQueryOptions(tunnelSlug))
  return <TunnelEditModal tunnel={tunnel} onClose={() => navigate({ to: '/tunnels' })} />
}
