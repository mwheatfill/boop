import type { VariantProps } from 'class-variance-authority'
import { CircleAlert, CircleCheck, CircleDashed, CircleHelp, CircleX } from 'lucide-react'
import { Badge, type badgeVariants } from '@/components/ui/badge'
import type { TunnelHealth } from '@/lib/tunnels/health'

type Variant = NonNullable<VariantProps<typeof badgeVariants>['variant']>

const config: Record<TunnelHealth, { variant: Variant; label: string; Icon: typeof CircleCheck }> =
  {
    operational: { variant: 'success', label: 'Operational', Icon: CircleCheck },
    degraded: { variant: 'warning', label: 'Degraded', Icon: CircleAlert },
    down: { variant: 'destructive', label: 'Down', Icon: CircleX },
    not_connected: { variant: 'outline', label: 'Not connected', Icon: CircleDashed },
    unverified: { variant: 'secondary', label: 'Unverified', Icon: CircleHelp },
  }

export function TunnelHealthBadge({ health }: { health: TunnelHealth }) {
  const { variant, label, Icon } = config[health]
  return (
    <Badge variant={variant}>
      <Icon data-icon="inline-start" aria-hidden />
      {label}
    </Badge>
  )
}
