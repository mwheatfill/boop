export function formatDurationMs(ms: number | null): string {
  if (ms === null) return '—'
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(2)}s`
}

export function formatRunDuration(startedAt: string | null, completedAt: string | null): string {
  if (!startedAt || !completedAt) return '—'
  return formatDurationMs(new Date(completedAt).getTime() - new Date(startedAt).getTime())
}
