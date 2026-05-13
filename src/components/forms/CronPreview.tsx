import { useMemo } from 'react'
import { nextRuns } from '@/lib/cron/next-runs'

interface CronPreviewProps {
  expression: string
  timezone: string
  count?: number
}

export function CronPreview({ expression, timezone, count = 3 }: CronPreviewProps) {
  const fires = useMemo(() => {
    if (!expression || !timezone) return null
    try {
      return nextRuns({ expression, timezone, n: count })
    } catch {
      return null
    }
  }, [expression, timezone, count])

  if (!fires) {
    return (
      <p className="text-xs text-muted-foreground">
        Enter a valid cron expression and timezone to see the next firings.
      </p>
    )
  }

  const formatter = Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    dateStyle: 'medium',
    timeStyle: 'short',
  })

  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs font-medium text-muted-foreground">
        Next {count} firings in {timezone}
      </p>
      <ul className="font-mono text-xs">
        {fires.map((d) => (
          <li key={d.toISOString()}>{formatter.format(d)}</li>
        ))}
      </ul>
    </div>
  )
}
