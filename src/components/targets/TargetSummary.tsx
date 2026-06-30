import { Badge } from '@/components/ui/badge'
import type { Target } from '@/shared/schemas/target'
import { TargetHealthBadge } from './TargetHealthBadge'

// Compact at-a-glance facts for a Target: method, public/private, health, address.
export function TargetSummary({
  target,
}: {
  target: Pick<Target, 'method' | 'reachability' | 'url' | 'internalOrigin' | 'health'>
}) {
  const isTunnel = target.reachability === 'tunnel'
  const address = (isTunnel ? target.internalOrigin : target.url) || '—'
  return (
    <div className="flex flex-col gap-2 rounded-md border border-border bg-muted/30 px-3 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">{target.method}</Badge>
        <Badge variant="outline">{isTunnel ? 'Private' : 'Public'}</Badge>
        {target.health ? <TargetHealthBadge health={target.health} /> : null}
      </div>
      <span className="break-all font-mono text-xs text-muted-foreground">{address}</span>
    </div>
  )
}
