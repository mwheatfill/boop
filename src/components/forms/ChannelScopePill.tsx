import { cn } from '@/lib/utils'
import type { ChannelScope } from '@/shared/schemas/channel'

interface ChannelScopePillProps {
  scope: ChannelScope
  className?: string | undefined
}

export function ChannelScopePill({ scope, className }: ChannelScopePillProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide',
        scope === 'workspace' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
        className,
      )}
    >
      {scope}
    </span>
  )
}
