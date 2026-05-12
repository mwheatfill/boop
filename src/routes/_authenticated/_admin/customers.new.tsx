import { useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { CustomerForm } from '@/components/forms/CustomerForm'
import { createCustomerFn } from '@/lib/customers/server-fns'

export const Route = createFileRoute('/_authenticated/_admin/customers/new')({
  component: NewCustomerPage,
})

function NewCustomerPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">New Customer</h1>
      <CustomerForm
        variant="create"
        submitLabel="Create Customer"
        initialValues={{ name: '', slug: '', timezone: 'America/New_York', autotaskCompanyId: '' }}
        mutate={(value) => createCustomerFn({ data: value as never })}
        onSuccess={async (customer) => {
          await queryClient.invalidateQueries({ queryKey: ['customers'] })
          toast.success(`Customer ${customer.name} created`)
          await navigate({
            to: '/customers/$customerSlug',
            params: { customerSlug: customer.slug },
          })
        }}
      />
    </div>
  )
}
