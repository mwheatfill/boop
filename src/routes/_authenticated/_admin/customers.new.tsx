import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { CustomerModal } from '@/components/forms/CustomerModal'
import { orgTimezoneQueryOptions } from '@/lib/customers/query-options'

export const Route = createFileRoute('/_authenticated/_admin/customers/new')({
  loader: ({ context }) => context.queryClient.ensureQueryData(orgTimezoneQueryOptions),
  component: NewCustomerRoute,
})

function NewCustomerRoute() {
  const navigate = useNavigate()
  return <CustomerModal variant="create" onClose={() => navigate({ to: '/customers' })} />
}
