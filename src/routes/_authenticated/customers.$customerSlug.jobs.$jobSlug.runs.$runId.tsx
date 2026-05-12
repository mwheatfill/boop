import { queryOptions, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { Play } from 'lucide-react'
import { toast } from 'sonner'
import { AttemptCard } from '@/components/forms/AttemptCard'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { runJobNowFn } from '@/lib/jobs/server-fns'
import { formatRunDuration, outcomeVariant } from '@/lib/runs/format'
import { getRunFn } from '@/lib/runs/server-fns'

const runOptions = (customerSlug: string, jobSlug: string, runId: string) =>
  queryOptions({
    queryKey: ['runs', customerSlug, jobSlug, runId],
    queryFn: () => getRunFn({ data: { customerSlug, jobSlug, runId } }),
    refetchInterval: (query) => (query.state.data?.run.status === 'running' ? 5_000 : false),
    refetchIntervalInBackground: false,
  })

export const Route = createFileRoute(
  '/_authenticated/customers/$customerSlug/jobs/$jobSlug/runs/$runId',
)({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(
      runOptions(params.customerSlug, params.jobSlug, params.runId),
    ),
  component: RunDetailPage,
})

function RunDetailPage() {
  const { customerSlug, jobSlug, runId } = Route.useParams()
  const queryClient = useQueryClient()
  const { data: detail } = useSuspenseQuery(runOptions(customerSlug, jobSlug, runId))

  if (!detail) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Run not found</h1>
        <p className="text-sm text-muted-foreground">
          The run id <code className="font-mono">{runId}</code> does not exist or has been removed.
        </p>
        <Button
          render={<Link to="/customers/$customerSlug" params={{ customerSlug }} />}
          variant="outline"
        >
          Back to {customerSlug}
        </Button>
      </div>
    )
  }

  const { run, job, customer, target, attempts, displayOutcome } = detail
  const canRunNow = job.status === 'active'

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">
          <Link to="/customers" className="hover:underline">
            Customers
          </Link>
          {' › '}
          <Link to="/customers/$customerSlug" params={{ customerSlug }} className="hover:underline">
            {customer.name}
          </Link>
          {' › Jobs › '}
          <Link
            to="/customers/$customerSlug/jobs/$jobSlug"
            params={{ customerSlug, jobSlug }}
            className="hover:underline"
          >
            {job.name}
          </Link>
          {' › Run'}
        </p>
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold tracking-tight">Run {run.id}</h1>
            <p className="text-sm text-muted-foreground">
              {run.triggerSource} · scheduled {new Date(run.scheduledAt).toLocaleString()}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={outcomeVariant[displayOutcome]}>{displayOutcome}</Badge>
            <Button
              size="sm"
              disabled={!canRunNow}
              onClick={async () => {
                const result = await runJobNowFn({ data: { customerSlug, jobSlug } })
                if (result.ok) {
                  toast.success('Run queued')
                  await queryClient.invalidateQueries({ queryKey: ['jobs', job.id, 'runs'] })
                } else {
                  toast.error(result.message ?? 'Could not queue Run')
                }
              }}
            >
              <Play aria-hidden /> Run now
            </Button>
          </div>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-4">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Scheduled</p>
          <p className="text-sm">{new Date(run.scheduledAt).toLocaleString()}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Started</p>
          <p className="text-sm">
            {run.startedAt ? new Date(run.startedAt).toLocaleString() : '—'}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Completed</p>
          <p className="text-sm">
            {run.completedAt ? new Date(run.completedAt).toLocaleString() : '—'}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Duration</p>
          <p className="text-sm">{formatRunDuration(run.startedAt, run.completedAt)}</p>
        </div>
      </section>

      {run.skippedReason ? (
        <p className="rounded border border-warning/40 bg-warning/10 px-3 py-2 text-sm">
          Skipped: {run.skippedReason}
        </p>
      ) : null}

      <section className="flex flex-col gap-2">
        <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Target
        </h2>
        <p className="text-sm">
          <Link
            to="/customers/$customerSlug/targets/$targetSlug"
            params={{ customerSlug, targetSlug: target.slug }}
            className="font-medium hover:underline"
          >
            {target.name}
          </Link>{' '}
          · <code className="font-mono">{target.method}</code> {target.url}
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">
          Attempts <span className="text-sm text-muted-foreground">({attempts.length})</span>
        </h2>
        {attempts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No Attempts recorded for this Run.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {attempts.map((a) => (
              <AttemptCard key={a.id} attempt={a} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
