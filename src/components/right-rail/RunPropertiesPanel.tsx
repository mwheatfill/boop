import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Badge } from '@/components/ui/badge'
import { getRunFn } from '@/lib/runs/server-fns'
import { PropertyRow } from './PropertyRow'

interface RunPropertiesPanelProps {
  customerSlug: string
  jobSlug: string
  runId: string
}

function duration(startedAt: string | null, completedAt: string | null): string {
  if (!startedAt || !completedAt) return '—'
  const ms = new Date(completedAt).getTime() - new Date(startedAt).getTime()
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(2)}s`
}

const outcomeVariant: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  success: 'default',
  failure: 'destructive',
  timeout: 'destructive',
  skipped: 'secondary',
  running: 'default',
  scheduled: 'outline',
}

export function RunPropertiesPanel({ customerSlug, jobSlug, runId }: RunPropertiesPanelProps) {
  const { data: detail, isLoading } = useQuery({
    queryKey: ['runs', customerSlug, jobSlug, runId],
    queryFn: () => getRunFn({ data: { customerSlug, jobSlug, runId } }),
    refetchInterval: (query) => (query.state.data?.run.status === 'running' ? 5_000 : false),
    refetchIntervalInBackground: false,
  })

  if (isLoading) {
    return <p className="px-2 text-sm text-muted-foreground">Loading…</p>
  }
  if (!detail) {
    return <p className="px-2 text-sm text-muted-foreground">Run not found.</p>
  }

  const { run, job, customer, target, attempts, displayOutcome } = detail
  const lastFailure = [...attempts].reverse().find((a) => a.failureKind != null)

  return (
    <div className="flex flex-col px-2">
      <PropertyRow label="Outcome">
        <Badge variant={outcomeVariant[displayOutcome] ?? 'outline'}>{displayOutcome}</Badge>
      </PropertyRow>
      <PropertyRow label="Status">{run.status}</PropertyRow>
      <PropertyRow label="Trigger">{run.triggerSource}</PropertyRow>
      <PropertyRow label="Customer">
        <Link
          to="/customers/$customerSlug"
          params={{ customerSlug: customer.slug }}
          className="hover:underline"
        >
          {customer.name}
        </Link>
      </PropertyRow>
      <PropertyRow label="Job">
        <Link
          to="/customers/$customerSlug/jobs/$jobSlug"
          params={{ customerSlug: customer.slug, jobSlug: job.slug }}
          className="hover:underline"
        >
          {job.name}
        </Link>
      </PropertyRow>
      <PropertyRow label="Target" mono>
        {target.method} {target.name}
      </PropertyRow>
      <PropertyRow label="Scheduled at">{new Date(run.scheduledAt).toLocaleString()}</PropertyRow>
      <PropertyRow label="Started at">
        {run.startedAt ? new Date(run.startedAt).toLocaleString() : '—'}
      </PropertyRow>
      <PropertyRow label="Completed at">
        {run.completedAt ? new Date(run.completedAt).toLocaleString() : '—'}
      </PropertyRow>
      <PropertyRow label="Duration">{duration(run.startedAt, run.completedAt)}</PropertyRow>
      <PropertyRow label="Attempts">{attempts.length}</PropertyRow>
      {lastFailure?.failureKind ? (
        <PropertyRow label="Failure kind" mono>
          {lastFailure.failureKind}
        </PropertyRow>
      ) : null}
    </div>
  )
}
