import { infiniteQueryOptions, useInfiniteQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { RunStatusBadge } from '@/components/RunStatusBadge'
import { Button } from '@/components/ui/button'
import { listRunsForJobFn } from '@/lib/runs/server-fns'
import type { RunsListResponse } from '@/shared/schemas/run'

const PAGE_SIZE = 25

const recentRunsOptions = (jobId: string, customerSlug: string, jobSlug: string) =>
  infiniteQueryOptions({
    queryKey: ['jobs', jobId, 'runs'],
    queryFn: ({ pageParam }) =>
      listRunsForJobFn({
        data: {
          jobId,
          limit: PAGE_SIZE,
          ...(pageParam ? { cursor: pageParam } : {}),
        },
      }),
    initialPageParam: '' as string,
    getNextPageParam: (lastPage: RunsListResponse) => lastPage.nextCursor ?? undefined,
    refetchInterval: (query) => {
      const rows = query.state.data?.pages.flatMap((p) => p.rows)
      if (!rows) return false
      return rows.some((r) => r.status === 'running') ? 5_000 : false
    },
    meta: { customerSlug, jobSlug },
  })

interface RecentRunsPanelProps {
  jobId: string
  customerSlug: string
  jobSlug: string
}

function relativeTime(iso: string | null): string {
  if (!iso) return '—'
  const diffMs = Date.now() - new Date(iso).getTime()
  const minutes = Math.round(diffMs / 60_000)
  if (Math.abs(minutes) < 1) return 'just now'
  if (Math.abs(minutes) < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (Math.abs(hours) < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  return `${days}d ago`
}

export function RecentRunsPanel({ jobId, customerSlug, jobSlug }: RecentRunsPanelProps) {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery(
    recentRunsOptions(jobId, customerSlug, jobSlug),
  )

  if (!data) return null

  const rows = data.pages.flatMap((p) => p.rows)

  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No Runs yet. Click <span className="font-medium">Run now</span> to produce one.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-2">
        {rows.map((row) => (
          <li
            key={row.id}
            className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-sm"
          >
            <Link
              to="/customers/$customerSlug/jobs/$jobSlug/runs/$runId"
              params={{ customerSlug, jobSlug, runId: row.id }}
              className="flex flex-1 items-center gap-2 hover:underline"
            >
              <RunStatusBadge outcome={row.displayOutcome} />
              <span className="text-muted-foreground">{relativeTime(row.startedAt)}</span>
              <span className="text-xs text-muted-foreground">· {row.triggerSource}</span>
            </Link>
            <code className="font-mono text-xs text-muted-foreground">{row.id}</code>
          </li>
        ))}
      </ul>
      {hasNextPage ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="self-start"
          onClick={() => fetchNextPage()}
          disabled={isFetchingNextPage}
        >
          {isFetchingNextPage ? 'Loading…' : 'Load more'}
        </Button>
      ) : null}
    </div>
  )
}
