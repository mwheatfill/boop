import { queryOptions, useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { Pencil, Play } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { AlertsAppliedPanel } from '@/components/alerts/AlertsAppliedPanel'
import { ContentChrome } from '@/components/ContentChrome'
import { DateTime } from '@/components/DateTime'
import { JobActionsMenu } from '@/components/forms/JobActionsMenu'
import { JobSheet } from '@/components/forms/JobSheet'
import { RecentRunsPanel } from '@/components/forms/RecentRunsPanel'
import { SaveJobTemplateModal } from '@/components/forms/SaveJobTemplateModal'
import { TargetSheet } from '@/components/forms/TargetSheet'
import { WebhookSecretPanel } from '@/components/forms/WebhookSecretPanel'
import { useShortcut } from '@/components/keyboard/use-shortcut'
import { PinButton } from '@/components/PinButton'
import { StatusBadge } from '@/components/StatusBadge'
import { TargetOption } from '@/components/targets/TargetOption'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { isAdmin } from '@/lib/auth/is-admin'
import { triggerSummaryWithTimezone } from '@/lib/jobs/format'
import {
  archiveJobFn,
  getJobFn,
  pauseJobFn,
  restoreJobFn,
  resumeJobFn,
  runJobNowFn,
} from '@/lib/jobs/server-fns'
import { useTrackRecentVisit } from '@/lib/recents/use-track-recent-visit'
import { targetQueryOptions } from '@/lib/targets/query-options'

const jobOptions = (workspaceSlug: string, jobSlug: string) =>
  queryOptions({
    queryKey: ['workspaces', workspaceSlug, 'jobs', jobSlug],
    queryFn: () => getJobFn({ data: { workspaceSlug, jobSlug } }),
  })

export const Route = createFileRoute('/_authenticated/jobs_/$jobSlug/')({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(jobOptions(context.workspaceSlug, params.jobSlug)),
  component: JobDetailPage,
})

function JobDetailPage() {
  const { jobSlug } = Route.useParams()
  const { workspaceSlug, currentUser } = Route.useRouteContext()
  const goTo = useNavigate()
  const queryClient = useQueryClient()
  const { data: job } = useSuspenseQuery(jobOptions(workspaceSlug, jobSlug))
  const [archiveBlock, setArchiveBlock] = useState<string | null>(null)
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editingTarget, setEditingTarget] = useState(false)
  // Fetch the full Target (health + the edit record); fall back to the Job's ref while loading.
  const { data: fullTarget } = useQuery(targetQueryOptions(workspaceSlug, job.targetSlug))

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['workspaces', workspaceSlug] })
    await queryClient.invalidateQueries({ queryKey: ['jobs'] })
  }

  const simpleAction = (fn: typeof pauseJobFn, message: string) => async () => {
    setArchiveBlock(null)
    await fn({ data: { workspaceSlug, jobSlug } })
    await refresh()
    toast.success(message)
  }

  useTrackRecentVisit({
    id: `job:${job.workspaceSlug}:${job.slug}`,
    entity: 'job',
    label: job.name,
    slug: job.slug,
    workspaceSlug: job.workspaceSlug,
  })

  useShortcut(
    'r',
    async () => {
      if (job.status !== 'active') {
        toast.error('Job is not active.')
        return
      }
      const result = await runJobNowFn({ data: { workspaceSlug, jobSlug } })
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

  useShortcut('e', () => setEditOpen(true), {
    description: 'Edit Job',
    section: 'page',
  })

  useShortcut('n l', () => setSaveTemplateOpen(true), {
    description: 'Save as template',
    section: 'page',
  })

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">
          <Link to="/jobs" className="hover:underline">
            Jobs
          </Link>
        </p>
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold tracking-tight">{job.name}</h1>
            <p className="text-sm text-muted-foreground font-mono">{job.slug}</p>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={job.status} />
            <PinButton
              entity={{
                id: `job:${job.workspaceSlug}:${job.slug}`,
                kind: 'job',
                label: job.name,
                slug: job.slug,
                workspaceSlug: job.workspaceSlug,
              }}
            />
            <Button
              size="sm"
              disabled={job.status !== 'active'}
              onClick={async () => {
                const result = await runJobNowFn({ data: { workspaceSlug, jobSlug } })
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
            <JobSheet
              owner={{ workspaceSlug }}
              job={job}
              isAdmin={isAdmin(currentUser)}
              open={editOpen}
              onOpenChange={setEditOpen}
              trigger={
                <Button size="sm" variant="outline">
                  <Pencil aria-hidden /> Edit
                </Button>
              }
            />
            <JobActionsMenu
              status={job.status}
              onPause={simpleAction(pauseJobFn, 'Paused')}
              onResume={simpleAction(resumeJobFn, 'Resumed')}
              onArchive={async () => {
                setArchiveBlock(null)
                const result = await archiveJobFn({ data: { workspaceSlug, jobSlug } })
                if (!result.ok) {
                  setArchiveBlock(result.message ?? 'Archive blocked.')
                  return
                }
                await refresh()
                toast.success('Job deleted', { description: 'Find it in the Recycle Bin.' })
                await goTo({ to: '/jobs' })
              }}
              onRestore={simpleAction(restoreJobFn, 'Restored')}
              onSaveAsTemplate={() => setSaveTemplateOpen(true)}
            />
            <ContentChrome />
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
            <DateTime value={job.lastFireAt} fallback="No Runs yet" />
          </p>
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Next run</p>
          <p className="text-sm">
            <DateTime value={job.nextFireAt} fallback="Not scheduled" />
          </p>
        </div>
      </section>

      <Card className="group/target relative">
        <CardHeader>
          <CardTitle className="text-sm">Target</CardTitle>
        </CardHeader>
        <CardContent>
          <TargetOption target={fullTarget ?? job.target} />
        </CardContent>
        {isAdmin(currentUser) ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Edit Target"
            className="absolute top-3 right-3 opacity-0 transition-opacity focus-visible:opacity-100 group-hover/target:opacity-100"
            onClick={() => setEditingTarget(true)}
          >
            <Pencil aria-hidden />
          </Button>
        ) : null}
      </Card>
      {editingTarget && fullTarget ? (
        <TargetSheet
          owner={{ workspaceSlug }}
          target={fullTarget}
          open
          onOpenChange={(open) => {
            if (!open) setEditingTarget(false)
          }}
        />
      ) : null}

      {job.triggerKind === 'webhook' ? (
        <WebhookSecretPanel workspaceSlug={workspaceSlug} jobSlug={jobSlug} />
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

      <AlertsAppliedPanel workspaceSlug={workspaceSlug} />

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Recent Runs</h2>
        <RecentRunsPanel jobId={job.id} workspaceSlug={workspaceSlug} jobSlug={jobSlug} />
      </section>

      {saveTemplateOpen ? (
        <SaveJobTemplateModal job={job} onClose={() => setSaveTemplateOpen(false)} />
      ) : null}
    </div>
  )
}
