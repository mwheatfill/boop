import { CircleCheck, CirclePause, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

type LifecycleStatus = 'active' | 'paused' | 'archived'

const config: Record<
  LifecycleStatus,
  { variant: 'success' | 'warning' | 'outline'; label: string; Icon: typeof CircleCheck }
> = {
  active: { variant: 'success', label: 'Active', Icon: CircleCheck },
  paused: { variant: 'warning', label: 'Paused', Icon: CirclePause },
  archived: { variant: 'outline', label: 'Deleted', Icon: Trash2 },
}

export function StatusBadge({ status }: { status: LifecycleStatus }) {
  const { variant, label, Icon } = config[status]
  return (
    <Badge variant={variant}>
      <Icon data-icon="inline-start" aria-hidden />
      {label}
    </Badge>
  )
}
