import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { StatusBadge } from '@/components/StatusBadge'
import { getCustomerFn } from '@/lib/customers/server-fns'
import { getTargetFn } from '@/lib/targets/server-fns'
import { PropertyRow } from './PropertyRow'

interface TargetPropertiesPanelProps {
  customerSlug: string
  targetSlug: string
}

export function TargetPropertiesPanel({ customerSlug, targetSlug }: TargetPropertiesPanelProps) {
  const { data: target, isLoading } = useQuery({
    queryKey: ['customers', customerSlug, 'targets', targetSlug],
    queryFn: () => getTargetFn({ data: { customerSlug, targetSlug } }),
  })
  const { data: customer } = useQuery({
    queryKey: ['customers', customerSlug],
    queryFn: () => getCustomerFn({ data: { slug: customerSlug } }),
  })

  if (isLoading) {
    return <p className="px-2 text-sm text-muted-foreground">Loading…</p>
  }
  if (!target) {
    return <p className="px-2 text-sm text-muted-foreground">Target not found.</p>
  }

  return (
    <div className="flex flex-col px-2">
      <PropertyRow label="Status">
        <StatusBadge status={target.status} />
      </PropertyRow>
      <PropertyRow label="Method" mono>
        {target.method}
      </PropertyRow>
      <PropertyRow label="URL" mono>
        {target.url}
      </PropertyRow>
      <PropertyRow label="Auth">{target.authKind}</PropertyRow>
      <PropertyRow label="Reachability">{target.reachability}</PropertyRow>
      {customer ? (
        <PropertyRow label="Customer">
          <Link to="/customers/$customerSlug" params={{ customerSlug }} className="hover:underline">
            {customer.name}
          </Link>
        </PropertyRow>
      ) : null}
      <PropertyRow label="Slug" mono>
        {target.slug}
      </PropertyRow>
    </div>
  )
}
