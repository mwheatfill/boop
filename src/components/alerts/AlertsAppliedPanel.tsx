import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { ArrowRight, Bell } from 'lucide-react'
import { customerRuleCountQueryOptions } from '@/lib/alert-rules/query-options'

interface AlertsAppliedPanelProps {
  customerSlug: string
}

export function AlertsAppliedPanel({ customerSlug }: AlertsAppliedPanelProps) {
  const { data } = useQuery(customerRuleCountQueryOptions(customerSlug))
  const count = data?.count ?? 0
  if (count === 0) return null
  return (
    <Link
      to="/customers/$customerSlug/alert-rules"
      params={{ customerSlug }}
      className="group flex items-center justify-between rounded-md border border-border bg-muted/20 p-3 hover:border-primary/40"
    >
      <div className="flex items-center gap-3">
        <Bell className="size-4 text-muted-foreground" aria-hidden />
        <p className="text-sm">
          <span className="font-medium">
            {count} Customer-level rule{count === 1 ? '' : 's'} apply
          </span>{' '}
          <span className="text-muted-foreground">to this Job.</span>
        </p>
      </div>
      <ArrowRight className="size-4 text-muted-foreground group-hover:text-primary" aria-hidden />
    </Link>
  )
}
