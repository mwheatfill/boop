import { queryOptions, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { listRecentRunsForJobFn } from '@/lib/jobs/server-fns'
import type { Run } from '@/shared/schemas/run'

const PAGE_SIZE = 25

const recentRunsOptions = (jobId: string, limit: number) =>
  queryOptions({
    queryKey: ['jobs', jobId, 'runs', { limit }],
    queryFn: () => listRecentRunsForJobFn({ data: { jobId, limit } }),
    refetchInterval: (query) => {
      const runs = query.state.data
      if (!runs) return false
      return runs.some((r) => r.status === 'running') ? 5_000 : false
    },
  })

interface RecentRunsPanelProps {
  jobId: string
}

const outcomeVariant: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  success: 'default',
  failure: 'destructive',
  timeout: 'destructive',
}

const statusVariant: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  scheduled: 'secondary',
  running: 'default',
  completed: 'outline',
  canceled: 'secondary',
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

export function RecentRunsPanel({ jobId }: RecentRunsPanelProps) {
  const [limit, setLimit] = useState(PAGE_SIZE)
  const { data: runs } = useQuery(recentRunsOptions(jobId, limit))

  if (!runs) return null

  if (runs.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No Runs yet. Click <span className="font-medium">Run now</span> to produce one.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-2">
        {runs.map((run: Run) => (
          <li
            key={run.id}
            className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-sm"
          >
            <div className="flex items-center gap-2">
              <Badge variant={statusVariant[run.status]}>{run.status}</Badge>
              {run.outcome ? (
                <Badge variant={outcomeVariant[run.outcome]}>{run.outcome}</Badge>
              ) : null}
              <span className="text-muted-foreground">
                {relativeTime(run.startedAt ?? run.scheduledAt)}
              </span>
            </div>
            <code className="font-mono text-xs text-muted-foreground">{run.id}</code>
          </li>
        ))}
      </ul>
      {runs.length >= limit ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="self-start"
          onClick={() => setLimit(limit + PAGE_SIZE)}
        >
          Load more
        </Button>
      ) : null}
    </div>
  )
}
