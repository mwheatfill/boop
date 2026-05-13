import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { SearchableCombobox } from '@/components/forms/SearchableCombobox'
import { TemplateGallery } from '@/components/templates/TemplateGallery'
import { Button } from '@/components/ui/button'
import { listCustomersQueryOptions } from '@/lib/customers/query-options'
import { listJobTemplatesQueryOptions } from '@/lib/job-templates/query-options'
import type { Customer } from '@/shared/schemas/customer'
import type { JobTemplate } from '@/shared/schemas/job-template'

const templatesOptions = listJobTemplatesQueryOptions(undefined)
const customersOptions = listCustomersQueryOptions(false)

export const Route = createFileRoute('/_authenticated/templates')({
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(templatesOptions),
      context.queryClient.ensureQueryData(customersOptions),
    ])
  },
  component: TemplatesRoute,
})

function TemplatesRoute() {
  const navigate = useNavigate()
  const { data: templates } = useSuspenseQuery(templatesOptions)
  const { data: customers } = useSuspenseQuery(customersOptions)
  const [pendingTemplate, setPendingTemplate] = useState<JobTemplate | null>(null)
  const [customer, setCustomer] = useState<Customer | null>(customers[0] ?? null)

  const useTemplate = async () => {
    if (!pendingTemplate || !customer) return
    await navigate({
      to: '/customers/$customerSlug/jobs/new',
      params: { customerSlug: customer.slug },
      search: { from: pendingTemplate.id },
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Templates</h1>
          <p className="text-sm text-muted-foreground">
            Starter recipes and saved Job patterns, cloned into regular Jobs when used.
          </p>
        </div>
        <Button render={<Link to="/jobs/new" />}>
          <Plus aria-hidden /> Use a template
        </Button>
      </header>

      {pendingTemplate ? (
        <section className="flex flex-col gap-3 rounded-md border border-border bg-muted/20 p-3">
          <div>
            <p className="text-sm font-medium">Use {pendingTemplate.name}</p>
            <p className="text-xs text-muted-foreground">Choose the Customer for this new Job.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <SearchableCombobox<Customer>
              label="Customer"
              items={customers}
              value={customer}
              onValueChange={setCustomer}
              getId={(c) => c.slug}
              getLabel={(c) => c.name}
              getSecondary={(c) => c.slug}
              searchKeywords={(c) => [c.slug]}
            />
            <Button type="button" size="sm" onClick={useTemplate} disabled={!customer}>
              Create Job
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setPendingTemplate(null)}
            >
              Cancel
            </Button>
          </div>
        </section>
      ) : null}

      <section id="template-gallery">
        <TemplateGallery templates={templates} onSelect={setPendingTemplate} />
      </section>
    </div>
  )
}
