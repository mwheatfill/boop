import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { StatusBadge } from '@/components/StatusBadge'
import { triggerSummaryWithTimezone } from '@/lib/jobs/format'
import { getJobFn } from '@/lib/jobs/server-fns'
import { PropertyRow } from './PropertyRow'

interface JobPropertiesPanelProps {
  customerSlug: string
  jobSlug: string
}

export function JobPropertiesPanel({ customerSlug, jobSlug }: JobPropertiesPanelProps) {
  const { data: job, isLoading } = useQuery({
    queryKey: ['customers', customerSlug, 'jobs', jobSlug],
    queryFn: () => getJobFn({ data: { customerSlug, jobSlug } }),
  })

  if (isLoading) {
    return <p className="px-2 text-sm text-muted-foreground">Loading…</p>
  }
  if (!job) {
    return <p className="px-2 text-sm text-muted-foreground">Job not found.</p>
  }

  return (
    <div className="flex flex-col px-2">
      <PropertyRow label="Status">
        <StatusBadge status={job.status} />
      </PropertyRow>
      <PropertyRow label="Customer">
        <Link to="/customers/$customerSlug" params={{ customerSlug }} className="hover:underline">
          {job.customerName}
        </Link>
      </PropertyRow>
      <PropertyRow label="Target">
        <Link
          to="/customers/$customerSlug/targets/$targetSlug"
          params={{ customerSlug, targetSlug: job.targetSlug }}
          className="hover:underline"
        >
          {job.targetName}
        </Link>
      </PropertyRow>
      <PropertyRow label="Trigger" mono>
        {triggerSummaryWithTimezone(job)}
      </PropertyRow>
      <PropertyRow label="Last run">
        {job.lastFireAt ? new Date(job.lastFireAt).toLocaleString() : '—'}
      </PropertyRow>
      <PropertyRow label="Next run">
        {job.nextFireAt ? new Date(job.nextFireAt).toLocaleString() : '—'}
      </PropertyRow>
      <PropertyRow label="Max attempts">{job.maxAttempts}</PropertyRow>
      <PropertyRow label="Overall deadline">{`${Math.round(job.overallDeadlineMs / 1000)}s`}</PropertyRow>
      <PropertyRow label="Slug" mono>
        {job.slug}
      </PropertyRow>
    </div>
  )
}
