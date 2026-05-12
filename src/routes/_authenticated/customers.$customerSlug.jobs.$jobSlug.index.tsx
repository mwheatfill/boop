import { queryOptions, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { Pencil, Play } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { JobActionsMenu } from '@/components/forms/JobActionsMenu'
import { RecentRunsPanel } from '@/components/forms/RecentRunsPanel'
import { WebhookSecretPanel } from '@/components/forms/WebhookSecretPanel'
import { useShortcut } from '@/components/keyboard/use-shortcut'
import { StatusBadge } from '@/components/StatusBadge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { triggerSummaryWithTimezone } from '@/lib/jobs/format'
import {
  archiveJobFn,
  getJobFn,
  pauseJobFn,
  restoreJobFn,
  resumeJobFn,
  runJobNowFn,
} from '@/lib/jobs/server-fns'
import { visitRecent } from '@/lib/recents/store'

const jobOptions = (customerSlug: string, jobSlug: string) =>
  queryOptions({
    queryKey: ['customers', customerSlug, 'jobs', jobSlug],
    queryFn: () => getJobFn({ data: { customerSlug, jobSlug } }),
  })

export const Route = createFileRoute('/_authenticated/customers/$customerSlug/jobs/$jobSlug/')({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(jobOptions(params.customerSlug, params.jobSlug)),
  component: JobDetailPage,
})

function JobDetailPage() {
  const { customerSlug, jobSlug } = Route.useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: job } = useSuspenseQuery(jobOptions(customerSlug, jobSlug))
  const [archiveBlock, setArchiveBlock] = useState<string | null>(null)

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['customers', customerSlug] })
    await queryClient.invalidateQueries({ queryKey: ['jobs'] })
  }

  const simpleAction = (fn: typeof pauseJobFn, message: string) => async () => {
    setArchiveBlock(null)
    await fn({ data: { customerSlug, jobSlug } })
    await refresh()
    toast.success(message)
  }

  useEffect(() => {
    visitRecent({
      id: `job:${job.customerSlug}:${job.slug}`,
      entity: 'job',
      label: job.name,
      slug: job.slug,
      customerSlug: job.customerSlug,
    })
  }, [job.customerSlug, job.slug, job.name])

  useShortcut(
    'r',
    async () => {
      if (job.status !== 'active') {
        toast.error('Job is not active.')
        return
      }
      const result = await runJobNowFn({ data: { customerSlug, jobSlug } })
      if (result.ok) {
        toast.success('Run queued')
        await refresh()
      } else {
        toast.error(result.message ?? 'Could not queue Run')
      }
    },
    { description: 'Run now', section: 'page' },
  )

  useShortcut(
    'p',
    () => {
      const fn = job.status === 'paused' ? resumeJobFn : pauseJobFn
      const label = job.status === 'paused' ? 'Resumed' : 'Paused'
      void simpleAction(fn, label)()
    },
    { description: 'Pause / Resume', section: 'page' },
  )

  useShortcut(
    'e',
    () => {
      void navigate({
        to: '/customers/$customerSlug/jobs/$jobSlug/edit',
        params: { customerSlug, jobSlug },
      })
    },
    { description: 'Edit Job', section: 'page' },
  )

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">
          <Link to="/customers/$customerSlug" params={{ customerSlug }} className="hover:underline">
            {job.customerName}
          </Link>{' '}
          / Jobs
        </p>
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold tracking-tight">{job.name}</h1>
            <p className="text-sm text-muted-foreground font-mono">{job.slug}</p>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={job.status} />
            <Button
              size="sm"
              disabled={job.status !== 'active'}
              onClick={async () => {
                const result = await runJobNowFn({ data: { customerSlug, jobSlug } })
                if (result.ok) {
                  toast.success('Run queued')
                  await queryClient.invalidateQueries({
                    queryKey: ['jobs', job.id, 'runs'],
                  })
                } else {
                  toast.error(result.message ?? 'Could not queue Run')
                }
              }}
            >
              <Play aria-hidden /> Run now
            </Button>
            <Button
              size="sm"
              variant="outline"
              render={
                <Link
                  to="/customers/$customerSlug/jobs/$jobSlug/edit"
                  params={{ customerSlug, jobSlug }}
                />
              }
            >
              <Pencil aria-hidden /> Edit
            </Button>
            <JobActionsMenu
              status={job.status}
              onPause={simpleAction(pauseJobFn, 'Paused')}
              onResume={simpleAction(resumeJobFn, 'Resumed')}
              onArchive={async () => {
                setArchiveBlock(null)
                const result = await archiveJobFn({ data: { customerSlug, jobSlug } })
                if (!result.ok) {
                  setArchiveBlock(result.message ?? 'Archive blocked.')
                  return
                }
                await refresh()
                toast.success('Archived')
                await navigate({
                  to: '/customers/$customerSlug',
                  params: { customerSlug },
                })
              }}
              onRestore={simpleAction(restoreJobFn, 'Restored')}
            />
          </div>
        </div>
        {archiveBlock ? (
          <p className="rounded border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {archiveBlock}
          </p>
        ) : null}
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-1">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Trigger</p>
          <p className="font-mono text-sm">{triggerSummaryWithTimezone(job)}</p>
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Last run</p>
          <p className="text-sm">
            {job.lastFireAt ? new Date(job.lastFireAt).toLocaleString() : '—'}
          </p>
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Next run</p>
          <p className="text-sm">
            {job.nextFireAt ? new Date(job.nextFireAt).toLocaleString() : '—'}
          </p>
        </div>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Target</CardTitle>
          <CardDescription>
            <Link
              to="/customers/$customerSlug/targets/$targetSlug"
              params={{ customerSlug, targetSlug: job.targetSlug }}
              className="font-medium text-foreground hover:underline"
            >
              {job.targetName}
            </Link>
          </CardDescription>
        </CardHeader>
      </Card>

      {job.triggerKind === 'webhook' ? (
        <WebhookSecretPanel customerSlug={customerSlug} jobSlug={jobSlug} />
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Templates</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Body</p>
            <pre className="mt-1 overflow-x-auto rounded bg-muted p-2 font-mono text-xs">
              {job.bodyTemplate || <span className="text-muted-foreground">(empty)</span>}
            </pre>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Headers</p>
            <pre className="mt-1 overflow-x-auto rounded bg-muted p-2 font-mono text-xs">
              {job.headersTemplate || <span className="text-muted-foreground">(empty)</span>}
            </pre>
          </div>
        </CardContent>
      </Card>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Recent Runs</h2>
        <RecentRunsPanel jobId={job.id} customerSlug={customerSlug} jobSlug={jobSlug} />
      </section>
    </div>
  )
}
