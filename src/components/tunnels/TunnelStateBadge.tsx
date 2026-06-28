import type { VariantProps } from 'class-variance-authority'
import { CircleAlert, CircleCheck, CircleDashed, Download } from 'lucide-react'
import { Badge, type badgeVariants } from '@/components/ui/badge'
import type { TunnelState } from '@/lib/tunnels/health'

type Variant = NonNullable<VariantProps<typeof badgeVariants>['variant']>

const config: Record<TunnelState, { variant: Variant; label: string; Icon: typeof CircleCheck }> = {
  provisioning: { variant: 'secondary', label: 'Setting up…', Icon: CircleDashed },
  install_pending: { variant: 'warning', label: 'Install the connector', Icon: Download },
  operational: { variant: 'success', label: 'Operational', Icon: CircleCheck },
  attention: { variant: 'destructive', label: 'Needs attention', Icon: CircleAlert },
}

export function TunnelStateBadge({ state }: { state: TunnelState }) {
  const { variant, label, Icon } = config[state]
  return (
    <Badge variant={variant}>
      <Icon data-icon="inline-start" aria-hidden />
      {label}
    </Badge>
  )
}
