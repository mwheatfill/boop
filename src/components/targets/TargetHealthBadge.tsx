import type { VariantProps } from 'class-variance-authority'
import { CircleCheck, CircleDashed, CircleOff, ShieldAlert, Unplug } from 'lucide-react'
import { Badge, type badgeVariants } from '@/components/ui/badge'
import type { TargetHealth } from '@/shared/schemas/target'

type Variant = NonNullable<VariantProps<typeof badgeVariants>['variant']>

const config: Record<TargetHealth, { variant: Variant; label: string; Icon: typeof CircleCheck }> =
  {
    operational: { variant: 'success', label: 'Operational', Icon: CircleCheck },
    origin_unreachable: { variant: 'destructive', label: 'Origin unreachable', Icon: Unplug },
    tunnel_offline: { variant: 'secondary', label: 'Tunnel offline', Icon: CircleOff },
    auth_error: { variant: 'warning', label: 'Auth error', Icon: ShieldAlert },
    checking: { variant: 'outline', label: 'Checking…', Icon: CircleDashed },
  }

export function TargetHealthBadge({ health }: { health: TargetHealth }) {
  const { variant, label, Icon } = config[health]
  return (
    <Badge variant={variant}>
      <Icon data-icon="inline-start" aria-hidden />
      {label}
    </Badge>
  )
}
