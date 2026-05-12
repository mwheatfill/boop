import { queryOptions, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { toast } from 'sonner'
import { ArchiveDialog } from '@/components/forms/ArchiveDialog'
import { CustomerForm } from '@/components/forms/CustomerForm'
import { Button } from '@/components/ui/button'
import {
  archiveCustomerFn,
  getCustomerFn,
  restoreCustomerFn,
  updateCustomerFn,
} from '@/lib/customers/server-fns'

const customerQueryOptions = (slug: string) =>
  queryOptions({
    queryKey: ['customers', slug],
    queryFn: () => getCustomerFn({ data: { slug } }),
  })

export const Route = createFileRoute('/_authenticated/_admin/customers/$customerSlug/edit')({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(customerQueryOptions(params.customerSlug)),
  component: EditCustomerPage,
})

function EditCustomerPage() {
  const { customerSlug } = Route.useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: customer } = useSuspenseQuery(customerQueryOptions(customerSlug))
  const [archiveBlock, setArchiveBlock] = useState<string | null>(null)

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-start justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Edit {customer.name}</h1>
        <div className="flex items-center gap-2">
          {customer.status === 'archived' ? (
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                await restoreCustomerFn({ data: { slug: customerSlug } })
                await queryClient.invalidateQueries({ queryKey: ['customers'] })
                toast.success(`Restored ${customer.name}`)
                await navigate({
                  to: '/customers/$customerSlug',
                  params: { customerSlug },
                })
              }}
            >
              Restore
            </Button>
          ) : (
            <ArchiveDialog
              entityNoun="Customer"
              entityName={customer.name}
              onArchive={async () => {
                const result = await archiveCustomerFn({ data: { slug: customerSlug } })
                if (!result.ok) {
                  setArchiveBlock(result.message ?? 'Archive blocked.')
                  return
                }
                await queryClient.invalidateQueries({ queryKey: ['customers'] })
                toast.success(`Archived ${customer.name}`)
                await navigate({ to: '/customers' })
              }}
              blockReason={archiveBlock}
              onOpenChange={(open) => {
                if (!open) setArchiveBlock(null)
              }}
            />
          )}
        </div>
      </header>
      <CustomerForm
        variant="edit"
        submitLabel="Save changes"
        initialValues={{
          name: customer.name,
          slug: customer.slug,
          timezone: customer.timezone,
          autotaskCompanyId: customer.autotaskCompanyId ?? '',
        }}
        mutate={(value) => updateCustomerFn({ data: value as never })}
        onSuccess={async (updated) => {
          await queryClient.invalidateQueries({ queryKey: ['customers'] })
          toast.success(`Saved ${updated.name}`)
          await navigate({
            to: '/customers/$customerSlug',
            params: { customerSlug: updated.slug },
          })
        }}
      />
    </div>
  )
}
