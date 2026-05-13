import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { DateTime } from '@/components/DateTime'
import { RunStatusBadge } from '@/components/RunStatusBadge'
import { formatRunDuration } from '@/lib/runs/format'
import { getRunFn } from '@/lib/runs/server-fns'
import { PropertiesPanelShell } from './PropertiesPanelShell'
import { PropertyRow } from './PropertyRow'

interface RunPropertiesPanelProps {
  customerSlug: string
  jobSlug: string
  runId: string
}

export function RunPropertiesPanel({ customerSlug, jobSlug, runId }: RunPropertiesPanelProps) {
  const { data: detail, isLoading } = useQuery({
    queryKey: ['runs', customerSlug, jobSlug, runId],
    queryFn: () => getRunFn({ data: { customerSlug, jobSlug, runId } }),
    refetchInterval: (query) => (query.state.data?.run.status === 'running' ? 5_000 : false),
    refetchIntervalInBackground: false,
  })

  return (
    <PropertiesPanelShell isLoading={isLoading} missing={!detail} missingLabel="Run not found.">
      {detail ? <RunPropertiesBody detail={detail} /> : null}
    </PropertiesPanelShell>
  )
}

function RunPropertiesBody({
  detail,
}: {
  detail: NonNullable<Awaited<ReturnType<typeof getRunFn>>>
}) {
  const { run, job, customer, target, attempts, displayOutcome } = detail
  let lastFailure: (typeof attempts)[number] | undefined
  for (let i = attempts.length - 1; i >= 0; i--) {
    if (attempts[i]?.failureKind != null) {
      lastFailure = attempts[i]
      break
    }
  }

  return (
    <>
      <PropertyRow label="Outcome">
        <RunStatusBadge outcome={displayOutcome} />
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
      <PropertyRow label="Scheduled at">
        <DateTime value={run.scheduledAt} />
      </PropertyRow>
      <PropertyRow label="Started at">
        <DateTime value={run.startedAt} fallback="Not started" />
      </PropertyRow>
      <PropertyRow label="Completed at">
        <DateTime value={run.completedAt} fallback="Not completed" />
      </PropertyRow>
      <PropertyRow label="Duration">
        {formatRunDuration(run.startedAt, run.completedAt)}
      </PropertyRow>
      <PropertyRow label="Attempts">{attempts.length}</PropertyRow>
      {lastFailure?.failureKind ? (
        <PropertyRow label="Failure kind" mono>
          {lastFailure.failureKind}
        </PropertyRow>
      ) : null}
    </>
  )
}
