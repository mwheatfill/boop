import { queryOptions, useQuery, useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import type { ColumnDef } from '@tanstack/react-table'
import { Pencil, Plus } from 'lucide-react'
import { useState } from 'react'
import { z } from 'zod'
import { DataTable } from '@/components/DataTable'
import { EmptyState } from '@/components/EmptyState'
import { JobSheet } from '@/components/forms/JobSheet'
import { StatusBadge } from '@/components/StatusBadge'
import { TargetCell } from '@/components/targets/TargetOption'
import { Button } from '@/components/ui/button'
import { isAdmin } from '@/lib/auth/is-admin'
import { formatInTimezone } from '@/lib/format'
import { triggerKindLabel } from '@/lib/jobs/format'
import { effectiveTimezone } from '@/lib/jobs/queries'
import { jobQueryOptions } from '@/lib/jobs/query-options'
import { listAllJobsFn } from '@/lib/jobs/server-fns'
import type { JobSummary } from '@/shared/schemas/job'

const allJobsQueryOptions = (filters: { includeArchived?: boolean }) =>
  queryOptions({
    queryKey: ['jobs', filters],
    queryFn: () => listAllJobsFn({ data: filters }),
  })

const searchSchema = z.object({
  archived: z.boolean().optional(),
})

export const Route = createFileRoute('/_authenticated/jobs')({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({ archived: Boolean(search.archived) }),
  loader: ({ context, deps }) =>
    context.queryClient.ensureQueryData(allJobsQueryOptions({ includeArchived: deps.archived })),
  component: JobsPage,
})

function columnsFor(onEdit: ((job: JobSummary) => void) | null): ColumnDef<JobSummary>[] {
  const cols: ColumnDef<JobSummary>[] = [
    {
      accessorKey: 'name',
      header: 'Job',
      cell: ({ row }) => <span className="font-medium text-foreground">{row.original.name}</span>,
    },
    {
      id: 'target',
      accessorFn: (row) => row.target.name,
      header: 'Target',
      cell: ({ row }) => <TargetCell target={row.original.target} />,
    },
    {
      id: 'triggerKind',
      accessorFn: (row) => triggerKindLabel(row.triggerKind),
      header: 'Trigger',
      meta: { label: 'Trigger', filterVariant: 'select' },
    },
    {
      accessorKey: 'nextFireAt',
      header: 'Next run',
      cell: ({ row }) =>
        row.original.nextFireAt
          ? formatInTimezone(row.original.nextFireAt, effectiveTimezone(row.original))
          : 'Not scheduled',
    },
    {
      accessorKey: 'lastRunStartedAt',
      header: 'Last run',
      cell: ({ row }) =>
        row.original.lastRunStartedAt
          ? formatInTimezone(row.original.lastRunStartedAt, effectiveTimezone(row.original))
          : 'No Runs yet',
    },
    {
      accessorKey: 'status',
      header: 'Status',
      meta: { label: 'Status', filterVariant: 'select' },
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
  ]
  if (onEdit) {
    cols.push({
      id: 'actions',
      enableHiding: false,
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex justify-end">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Edit ${row.original.name}`}
            className="opacity-0 transition-opacity focus-visible:opacity-100 group-hover/row:opacity-100"
            onClick={(e) => {
              e.stopPropagation()
              onEdit(row.original)
            }}
          >
            <Pencil aria-hidden />
          </Button>
        </div>
      ),
    })
  }
  return cols
}

// Editing from a row needs the full Job (the list only has a summary), so fetch it
// on demand, then open the edit sheet once loaded.
function JobEditSheet({
  workspaceSlug,
  jobSlug,
  isAdmin: admin,
  onClose,
}: {
  workspaceSlug: string
  jobSlug: string
  isAdmin: boolean
  onClose: () => void
}) {
  const { data: job } = useQuery(jobQueryOptions(workspaceSlug, jobSlug))
  if (!job) return null
  return (
    <JobSheet
      job={job}
      isAdmin={admin}
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    />
  )
}

function JobsPage() {
  const navigate = Route.useNavigate()
  const search = Route.useSearch()
  const { currentUser, workspaceSlug } = Route.useRouteContext()
  const admin = isAdmin(currentUser)
  const archived = Boolean(search.archived)
  const { data: jobs } = useSuspenseQuery(allJobsQueryOptions({ includeArchived: archived }))
  const [editing, setEditing] = useState<{ workspaceSlug: string; jobSlug: string } | null>(null)

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-start justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Jobs</h1>
          <p className="text-sm text-muted-foreground">Scheduled calls to your Targets.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button render={<Link to="/" />} variant="outline" size="sm">
            ← Dashboard
          </Button>
          <JobSheet
            owner={{ workspaceSlug }}
            isAdmin={admin}
            trigger={
              <Button size="sm">
                <Plus aria-hidden /> New Job
              </Button>
            }
          />
        </div>
      </header>

      {jobs.length === 0 ? (
        <EmptyState
          title="No Jobs yet."
          description="Create a Job to schedule calls to a Target."
          action={
            <JobSheet
              owner={{ workspaceSlug }}
              isAdmin={admin}
              trigger={
                <Button>
                  <Plus aria-hidden /> New Job
                </Button>
              }
            />
          }
        />
      ) : (
        <DataTable
          columns={columnsFor(
            admin ? (j) => setEditing({ workspaceSlug: j.workspaceSlug, jobSlug: j.slug }) : null,
          )}
          data={jobs}
          gridKey="jobs"
          onRowClick={(j) => navigate({ to: '/jobs/$jobSlug', params: { jobSlug: j.slug } })}
        />
      )}

      {editing ? (
        <JobEditSheet {...editing} isAdmin={admin} onClose={() => setEditing(null)} />
      ) : null}
    </div>
  )
}
