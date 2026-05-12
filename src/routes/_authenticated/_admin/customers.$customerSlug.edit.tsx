import { queryOptions, useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { CustomerModal } from '@/components/forms/CustomerModal'
import { getCustomerFn } from '@/lib/customers/server-fns'

const customerOptions = (slug: string) =>
  queryOptions({
    queryKey: ['customers', slug],
    queryFn: () => getCustomerFn({ data: { slug } }),
  })

export const Route = createFileRoute('/_authenticated/_admin/customers/$customerSlug/edit')({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(customerOptions(params.customerSlug)),
  component: EditCustomerRoute,
})

function EditCustomerRoute() {
  const { customerSlug } = Route.useParams()
  const navigate = useNavigate()
  const { data: customer } = useSuspenseQuery(customerOptions(customerSlug))
  return (
    <CustomerModal
      variant="edit"
      initialCustomer={customer}
      onClose={() => navigate({ to: '/customers/$customerSlug', params: { customerSlug } })}
    />
  )
}
