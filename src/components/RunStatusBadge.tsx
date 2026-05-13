import type { VariantProps } from 'class-variance-authority'
import { Circle, CircleCheck, CircleDashed, CircleMinus, CircleX, TimerOff } from 'lucide-react'
import { Badge, type badgeVariants } from '@/components/ui/badge'

type Outcome = 'success' | 'failure' | 'timeout' | 'skipped' | 'running' | 'scheduled'

type Variant = NonNullable<VariantProps<typeof badgeVariants>['variant']>

const config: Record<Outcome, { variant: Variant; label: string; Icon: typeof CircleCheck }> = {
  success: { variant: 'success', label: 'Success', Icon: CircleCheck },
  failure: { variant: 'destructive', label: 'Failure', Icon: CircleX },
  timeout: { variant: 'destructive', label: 'Timeout', Icon: TimerOff },
  skipped: { variant: 'secondary', label: 'Skipped', Icon: CircleMinus },
  running: { variant: 'info', label: 'Running', Icon: Circle },
  scheduled: { variant: 'outline', label: 'Scheduled', Icon: CircleDashed },
}

export function RunStatusBadge({ outcome }: { outcome: Outcome }) {
  const { variant, label, Icon } = config[outcome]
  return (
    <Badge variant={variant}>
      <Icon
        data-icon="inline-start"
        aria-hidden
        className={outcome === 'running' ? 'fill-current' : undefined}
      />
      {label}
    </Badge>
  )
}
