import { useQuery } from '@tanstack/react-query'
import { StatusBadge } from '@/components/StatusBadge'
import { getCustomerFn } from '@/lib/customers/server-fns'
import { listAllJobsFn } from '@/lib/jobs/server-fns'
import { listTargetsForCustomerFn } from '@/lib/targets/server-fns'
import { PropertiesPanelShell } from './PropertiesPanelShell'
import { PropertyRow } from './PropertyRow'

interface CustomerPropertiesPanelProps {
  customerSlug: string
}

export function CustomerPropertiesPanel({ customerSlug }: CustomerPropertiesPanelProps) {
  const { data: customer, isLoading } = useQuery({
    queryKey: ['customers', customerSlug],
    queryFn: () => getCustomerFn({ data: { slug: customerSlug } }),
  })
  const { data: jobs } = useQuery({
    queryKey: ['customers', customerSlug, 'jobs'],
    queryFn: () => listAllJobsFn({ data: { customerSlug } }),
  })
  const { data: targets } = useQuery({
    queryKey: ['customers', customerSlug, 'targets', { includeArchived: false }],
    queryFn: () => listTargetsForCustomerFn({ data: { customerSlug, includeArchived: false } }),
  })

  return (
    <PropertiesPanelShell
      isLoading={isLoading}
      missing={!customer}
      missingLabel="Customer not found."
    >
      {customer ? (
        <>
          <PropertyRow label="Status">
            <StatusBadge status={customer.status} />
          </PropertyRow>
          <PropertyRow label="Slug" mono>
            {customer.slug}
          </PropertyRow>
          <PropertyRow label="Timezone" mono>
            {customer.timezone}
          </PropertyRow>
          {customer.autotaskCompanyId ? (
            <PropertyRow label="Autotask ID" mono>
              {customer.autotaskCompanyId}
            </PropertyRow>
          ) : null}
          <PropertyRow label="Jobs">{jobs ? jobs.length : '—'}</PropertyRow>
          <PropertyRow label="Targets">{targets ? targets.length : '—'}</PropertyRow>
        </>
      ) : null}
    </PropertiesPanelShell>
  )
}
