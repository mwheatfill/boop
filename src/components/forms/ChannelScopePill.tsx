import { cn } from '@/lib/utils'
import type { ChannelScope } from '@/shared/schemas/channel'

interface ChannelScopePillProps {
  scope: ChannelScope
  customerName?: string | undefined
  className?: string | undefined
}

export function ChannelScopePill({ scope, customerName, className }: ChannelScopePillProps) {
  const label = scope === 'workspace' ? 'workspace' : (customerName ?? 'Customer')
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide',
        scope === 'workspace' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
        className,
      )}
    >
      {label}
    </span>
  )
}
