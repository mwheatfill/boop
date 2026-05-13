import { formatLocalDateTime } from '@/lib/format'

interface DateTimeProps {
  value: string | Date | null | undefined
  fallback?: string
}

export function DateTime({ value, fallback = 'Not available' }: DateTimeProps) {
  if (!value) return fallback

  const iso = value instanceof Date ? value.toISOString() : value

  return (
    <time dateTime={iso} suppressHydrationWarning>
      {formatLocalDateTime(iso)}
    </time>
  )
}
