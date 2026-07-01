import { useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { ArrowRight, Pause, Play } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { dashboardKeys } from '@/lib/dashboard/query-options'
import { jobKeys } from '@/lib/jobs/query-options'
import { pauseJobFn, resumeJobFn, runJobNowFn } from '@/lib/jobs/server-fns'

interface JobRowActionsProps {
  workspaceSlug: string
  jobSlug: string
  status: 'paused' | 'failing'
}

/**
 * Inline action cluster revealed on row hover / focus. Used by Needs Attention
 * and other dashboard rollups so triage happens without a drill-in.
 */
export function JobRowActions({ workspaceSlug, jobSlug, status }: JobRowActionsProps) {
  const queryClient = useQueryClient()
  const [busy, setBusy] = useState(false)

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: dashboardKeys.all() })
    await queryClient.invalidateQueries({ queryKey: jobKeys.lists() })
  }

  const runNow = async () => {
    if (busy) return
    setBusy(true)
    const result = await runJobNowFn({ data: { workspaceSlug, jobSlug } })
    setBusy(false)
    if (result.ok) {
      toast.success('Run queued')
      await invalidate()
    } else {
      toast.error(result.message ?? 'Could not queue Run')
    }
  }

  const togglePause = async () => {
    if (busy) return
    setBusy(true)
    const fn = status === 'paused' ? resumeJobFn : pauseJobFn
    const result = await fn({ data: { workspaceSlug, jobSlug } })
    setBusy(false)
    if (result.ok) {
      toast.success(status === 'paused' ? 'Resumed' : 'Paused')
      await invalidate()
    } else {
      toast.error(result.message ?? 'Could not change status')
    }
  }

  return (
    <div className="flex items-center gap-1 opacity-0 transition-opacity duration-100 group-hover:opacity-100 group-focus-within:opacity-100">
      <Button
        size="xs"
        variant="outline"
        onClick={runNow}
        disabled={busy || status === 'paused'}
        aria-label="Run now"
      >
        <Play aria-hidden /> Run now
      </Button>
      <Button size="xs" variant="outline" onClick={togglePause} disabled={busy}>
        {status === 'paused' ? (
          <>
            <Play aria-hidden /> Resume
          </>
        ) : (
          <>
            <Pause aria-hidden /> Pause
          </>
        )}
      </Button>
      <Button
        size="xs"
        variant="ghost"
        render={<Link to="/jobs/$jobSlug" params={{ jobSlug }} />}
        aria-label="Open Job"
      >
        Open <ArrowRight aria-hidden />
      </Button>
    </div>
  )
}
