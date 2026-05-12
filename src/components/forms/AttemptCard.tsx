import { useState } from 'react'
import { BodyViewer } from '@/components/forms/BodyViewer'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import type { AttemptDetail } from '@/shared/schemas/run'

interface AttemptCardProps {
  attempt: AttemptDetail
}

function duration(startedAt: string, completedAt: string | null): string {
  if (!completedAt) return '—'
  const ms = new Date(completedAt).getTime() - new Date(startedAt).getTime()
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(2)}s`
}

export function AttemptCard({ attempt }: AttemptCardProps) {
  const [expanded, setExpanded] = useState(false)
  const isFailure = attempt.failureKind !== null
  const isOk = attempt.httpStatus !== null && attempt.httpStatus >= 200 && attempt.httpStatus < 300

  return (
    <Card size="sm">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm">
            <span className="font-medium">Attempt {attempt.attemptNumber}</span>
            <span className="text-muted-foreground">
              {duration(attempt.startedAt, attempt.completedAt)}
            </span>
            {attempt.httpStatus !== null ? (
              <Badge variant={isOk ? 'default' : 'destructive'}>HTTP {attempt.httpStatus}</Badge>
            ) : null}
            {isFailure ? <Badge variant="destructive">{attempt.failureKind}</Badge> : null}
          </div>
          <Button type="button" variant="outline" size="xs" onClick={() => setExpanded((v) => !v)}>
            {expanded ? 'Hide bodies' : 'Show bodies'}
          </Button>
        </div>
      </CardHeader>
      {expanded ? (
        <CardContent className="flex flex-col gap-4 sm:flex-row">
          <div className="flex flex-1 flex-col gap-2">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Request
            </p>
            <BodyViewer attemptId={attempt.id} kind="request" enabled={expanded} />
            {attempt.requestHeaders ? (
              <div className="flex flex-col gap-1">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Headers
                </p>
                <pre className="overflow-x-auto rounded bg-muted p-2 font-mono text-xs">
                  {JSON.stringify(attempt.requestHeaders, null, 2)}
                </pre>
              </div>
            ) : null}
          </div>
          <div className="flex flex-1 flex-col gap-2">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Response
            </p>
            <BodyViewer attemptId={attempt.id} kind="response" enabled={expanded} />
          </div>
        </CardContent>
      ) : null}
    </Card>
  )
}
