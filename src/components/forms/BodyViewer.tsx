import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { runsKeys } from '@/lib/runs/keys'
import { getAttemptBodyPreviewFn } from '@/lib/runs/server-fns'

interface BodyViewerProps {
  attemptId: string
  kind: 'request' | 'response'
  enabled: boolean
}

function tryPrettyJson(text: string): string {
  try {
    return JSON.stringify(JSON.parse(text), null, 2)
  } catch {
    return text
  }
}

export function BodyViewer({ attemptId, kind, enabled }: BodyViewerProps) {
  const { data, isLoading } = useQuery({
    queryKey: runsKeys.attemptBody(attemptId, kind),
    queryFn: () => getAttemptBodyPreviewFn({ data: { attemptId, kind } }),
    enabled,
  })

  if (!enabled) return null
  if (isLoading) return <p className="text-xs text-muted-foreground">Loading preview…</p>
  if (!data) {
    return <p className="text-xs text-muted-foreground">No {kind} body recorded.</p>
  }

  const display =
    data.encoding === 'utf-8' && data.contentType.includes('json')
      ? tryPrettyJson(data.preview)
      : data.preview

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-muted-foreground">
        {data.contentType} · {data.size} bytes
        {data.truncated ? ' · preview truncated' : ''}
      </p>
      <pre className="overflow-x-auto rounded bg-muted p-2 font-mono text-xs">
        {data.encoding === 'base64' ? `(base64, ${data.size} bytes)` : display}
      </pre>
      <Button
        variant="outline"
        size="xs"
        className="self-start"
        render={
          <a href={`/api/attempts/${attemptId}/body/${kind}`} download>
            Download full
          </a>
        }
      />
    </div>
  )
}
