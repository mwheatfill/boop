import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { CustomerModal } from '@/components/forms/CustomerModal'

export const Route = createFileRoute('/_authenticated/_admin/customers/new')({
  component: NewCustomerRoute,
})

function NewCustomerRoute() {
  const navigate = useNavigate()
  return <CustomerModal variant="create" onClose={() => navigate({ to: '/customers' })} />
}
