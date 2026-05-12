import { queryOptions, useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowRight, CircleAlert, CircleCheck, Plus } from 'lucide-react'
import { useEffect } from 'react'
import { toast } from 'sonner'
import { z } from 'zod'
import { JobRowActions } from '@/components/dashboard/JobRowActions'
import { RunsAreaChart } from '@/components/dashboard/RunsAreaChart'
import { SearchHint } from '@/components/dashboard/SearchHint'
import { StatTile } from '@/components/dashboard/StatTile'
import { EmptyState } from '@/components/EmptyState'
import { Button } from '@/components/ui/button'
import { countCustomersFn, listCustomersFn } from '@/lib/customers/server-fns'
import { dashboardSummaryQueryOptions } from '@/lib/dashboard/query-options'
import type {
  NeedsAttentionRow,
  RecentFailureRow,
  UpcomingFireRow,
} from '@/shared/schemas/dashboard'

const customerCountQueryOptions = queryOptions({
  queryKey: ['customers', 'count'],
  queryFn: () => countCustomersFn(),
})

const customersListQueryOptions = queryOptions({
  queryKey: ['customers', { includeArchived: false }],
  queryFn: () => listCustomersFn({ data: { includeArchived: false } }),
})

const searchSchema = z.object({
  unauthorized: z.string().optional(),
})

export const Route = createFileRoute('/')({
  validateSearch: searchSchema,
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(customerCountQueryOptions),
      context.queryClient.ensureQueryData(dashboardSummaryQueryOptions),
      context.queryClient.ensureQueryData(customersListQueryOptions),
    ])
  },
  component: DashboardPage,
})

function trendDelta(points: { v: number }[]): number {
  if (points.length < 2) return 0
  const first = points[0]?.v ?? 0
  const last = points[points.length - 1]?.v ?? 0
  return Math.round((last - first) * 10) / 10
}

function DashboardPage() {
  const search = Route.useSearch()
  const { data: customerCount } = useSuspenseQuery(customerCountQueryOptions)
  const { data: summary } = useSuspenseQuery(dashboardSummaryQueryOptions)
  const { data: customers } = useSuspenseQuery(customersListQueryOptions)

  useEffect(() => {
    if (search.unauthorized) {
      toast.error('You do not have access to that page.', {
        description: `${search.unauthorized} requires Admin access.`,
      })
    }
  }, [search.unauthorized])

  if (customerCount === 0) {
    return (
      <EmptyState
        title="Welcome to boop."
        description="Create your first Customer to get started."
        action={
          <Button render={<Link to="/customers/new" />}>
            <Plus aria-hidden /> New Customer
          </Button>
        }
      />
    )
  }

  const firstCustomerSlug = customers[0]?.slug

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Operations</h1>
        <div className="flex items-center gap-3">
          <SearchHint />
          {firstCustomerSlug ? (
            <Button
              render={
                <Link
                  to="/customers/$customerSlug/jobs/new"
                  params={{ customerSlug: firstCustomerSlug }}
                  mask={{ to: '/' }}
                />
              }
            >
              <Plus aria-hidden /> New Job
            </Button>
          ) : null}
        </div>
      </header>

      <section aria-label="Workspace stats" className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile
          label="Active Jobs"
          value={summary.stats.activeJobs}
          sparkline={summary.sparklines.activeJobs}
          trend={trendDelta(summary.sparklines.activeJobs)}
        />
        <StatTile
          label="Failing 24h"
          value={summary.stats.failingToday}
          sparkline={summary.sparklines.failingToday}
          trend={-trendDelta(summary.sparklines.failingToday)}
        />
        <StatTile
          label="Runs 24h"
          value={summary.stats.runsToday}
          sparkline={summary.sparklines.runsToday}
          trend={trendDelta(summary.sparklines.runsToday)}
        />
        <StatTile
          label="Success 7d"
          value={`${summary.stats.successRate7d}%`}
          sparkline={summary.sparklines.successRate7d}
          trend={trendDelta(summary.sparklines.successRate7d)}
          trendSuffix="%"
        />
      </section>

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-medium">
            <CircleAlert className="size-4 text-warning" aria-hidden /> Needs attention
          </h2>
          <Link to="/jobs" className="text-xs text-muted-foreground hover:text-foreground">
            View all Jobs →
          </Link>
        </div>
        <NeedsAttentionList rows={summary.needsAttention} />
      </section>

      <section className="grid gap-3 md:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-2 rounded-md border border-border bg-card p-4">
          <h2 className="text-sm font-medium">Runs (7d)</h2>
          <RunsAreaChart series={summary.runsSeries7d} />
        </div>
        <div className="flex flex-col gap-2 rounded-md border border-border bg-card p-4">
          <h2 className="text-sm font-medium">Upcoming fires (24h)</h2>
          <UpcomingFiresList rows={summary.upcomingFires} />
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium">Recent failures</h2>
          <Link to="/runs" className="text-xs text-muted-foreground hover:text-foreground">
            View Runs →
          </Link>
        </div>
        <RecentFailuresList rows={summary.recentFailures} />
      </section>
    </div>
  )
}

function NeedsAttentionList({ rows }: { rows: NeedsAttentionRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-border bg-muted/20 px-3 py-3 text-sm text-muted-foreground">
        <CircleCheck className="size-4 text-success" aria-hidden /> Everything's green.
      </div>
    )
  }
  return (
    <ul className="flex flex-col rounded-md border border-border bg-card">
      {rows.map((r) => (
        <li
          key={`${r.customerSlug}-${r.jobSlug}`}
          className="group flex items-center gap-3 border-b border-border/40 px-3 py-2 last:border-b-0"
        >
          <span
            aria-hidden
            className={
              r.status === 'paused'
                ? 'inline-block size-2 rounded-full border border-warning'
                : 'inline-block size-2 rounded-full bg-destructive'
            }
          />
          <Link
            to="/customers/$customerSlug/jobs/$jobSlug"
            params={{ customerSlug: r.customerSlug, jobSlug: r.jobSlug }}
            className="flex-1 truncate text-sm hover:underline"
          >
            <span className="text-muted-foreground">{r.customerName}</span>
            <span className="mx-1.5 text-muted-foreground/50">·</span>
            <span className="font-medium">{r.jobName}</span>
          </Link>
          <span className="text-xs text-muted-foreground">
            {r.status === 'paused'
              ? 'paused'
              : r.lastFailureAt
                ? relativeAgo(r.lastFailureAt)
                : 'failing'}
          </span>
          <JobRowActions customerSlug={r.customerSlug} jobSlug={r.jobSlug} status={r.status} />
        </li>
      ))}
    </ul>
  )
}

function UpcomingFiresList({ rows }: { rows: UpcomingFireRow[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">Nothing scheduled in the next 24h.</p>
  }
  return (
    <ul className="flex flex-col">
      {rows.map((r) => (
        <li
          key={`${r.customerSlug}-${r.jobSlug}`}
          className="flex items-center justify-between gap-2 border-b border-border/40 py-1.5 text-sm last:border-b-0"
        >
          <Link
            to="/customers/$customerSlug/jobs/$jobSlug"
            params={{ customerSlug: r.customerSlug, jobSlug: r.jobSlug }}
            className="flex-1 truncate hover:underline"
            title={r.triggerSummary}
          >
            <span className="text-muted-foreground">{r.customerName}</span>
            <span className="mx-1.5 text-muted-foreground/50">·</span>
            <span>{r.jobName}</span>
          </Link>
          <span className="font-mono text-xs text-muted-foreground">
            {relativeIn(r.nextFireAt)}
          </span>
        </li>
      ))}
    </ul>
  )
}

function RecentFailuresList({ rows }: { rows: RecentFailureRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-border bg-muted/20 px-3 py-3 text-sm text-muted-foreground">
        <CircleCheck className="size-4 text-success" aria-hidden /> No recent failures.
      </div>
    )
  }
  return (
    <ul className="flex flex-col rounded-md border border-border bg-card">
      {rows.map((r) => (
        <li
          key={r.runId}
          className="flex items-center gap-3 border-b border-border/40 px-3 py-2 last:border-b-0 text-sm"
        >
          <span aria-hidden className="inline-block size-2 rounded-full bg-destructive" />
          <span className="flex-1 truncate">
            <span className="text-muted-foreground">{r.customerName}</span>
            <span className="mx-1.5 text-muted-foreground/50">·</span>
            <span className="font-medium">{r.jobName}</span>
            <span className="ml-2 rounded-sm bg-destructive/10 px-1.5 py-0.5 text-xs text-destructive">
              {r.outcome}
            </span>
          </span>
          <span className="text-xs text-muted-foreground">
            {r.completedAt ? relativeAgo(r.completedAt) : '—'}
          </span>
          <Link
            to="/customers/$customerSlug/jobs/$jobSlug/runs/$runId"
            params={{
              customerSlug: r.customerSlug,
              jobSlug: r.jobSlug,
              runId: r.runId,
            }}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Open Run <ArrowRight aria-hidden className="inline size-3" />
          </Link>
        </li>
      ))}
    </ul>
  )
}

function relativeAgo(ms: number): string {
  const diff = Date.now() - ms
  const m = Math.floor(diff / 60_000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}

function relativeIn(ms: number): string {
  const diff = ms - Date.now()
  if (diff <= 0) return 'now'
  const m = Math.floor(diff / 60_000)
  if (m < 60) return `in ${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `in ${h}h`
  return `in ${Math.floor(h / 24)}d`
}
