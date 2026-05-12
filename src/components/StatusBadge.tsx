import { Badge } from '@/components/ui/badge'

type LifecycleStatus = 'active' | 'paused' | 'archived'

const variantByStatus: Record<LifecycleStatus, 'default' | 'secondary' | 'outline'> = {
  active: 'default',
  paused: 'secondary',
  archived: 'outline',
}

const labelByStatus: Record<LifecycleStatus, string> = {
  active: 'Active',
  paused: 'Paused',
  archived: 'Archived',
}

export function StatusBadge({ status }: { status: LifecycleStatus }) {
  return <Badge variant={variantByStatus[status]}>{labelByStatus[status]}</Badge>
}
