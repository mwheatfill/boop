import { queryOptions, useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { TargetModal } from '@/components/forms/TargetModal'
import { getTargetFn } from '@/lib/targets/server-fns'

const targetQueryOptions = (customerSlug: string, targetSlug: string) =>
  queryOptions({
    queryKey: ['customers', customerSlug, 'targets', targetSlug],
    queryFn: () => getTargetFn({ data: { customerSlug, targetSlug } }),
  })

export const Route = createFileRoute(
  '/_authenticated/_admin/customers/$customerSlug/targets/$targetSlug',
)({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(targetQueryOptions(params.customerSlug, params.targetSlug)),
  component: EditTargetRoute,
})

function EditTargetRoute() {
  const { customerSlug, targetSlug } = Route.useParams()
  const navigate = useNavigate()
  const { data: target } = useSuspenseQuery(targetQueryOptions(customerSlug, targetSlug))
  return (
    <TargetModal
      variant="edit"
      customerSlug={customerSlug}
      initialTarget={target}
      onClose={() => navigate({ to: '/customers/$customerSlug', params: { customerSlug } })}
    />
  )
}
