import { Globe, Lock } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { Target, TargetRef } from '@/shared/schemas/target'
import { TargetHealthBadge } from './TargetHealthBadge'

// A Target ref (no health) or a full Target (health shown when present).
type TargetFacts = TargetRef & { health?: Target['health'] }

export function targetAddress(
  t: Pick<TargetRef, 'reachability' | 'url' | 'internalOrigin'>,
): string {
  return (t.reachability === 'tunnel' ? t.internalOrigin : t.url) || '—'
}

// Name + context (method, Public/Private, health, address). Shared by the Target
// picker (trigger + options) and anywhere a Job references its Target.
export function TargetOption({ target }: { target: TargetFacts }) {
  const isTunnel = target.reachability === 'tunnel'
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1 text-left">
      <span className="font-medium text-foreground">{target.name}</span>
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant="secondary">{target.method}</Badge>
        <Badge variant="outline">{isTunnel ? 'Private' : 'Public'}</Badge>
        {target.health ? <TargetHealthBadge health={target.health} /> : null}
      </div>
      <span className="break-all font-mono text-xs text-muted-foreground">
        {targetAddress(target)}
      </span>
    </div>
  )
}

// Compact two-line cell for tables: name with a Public/Private icon, address beneath.
export function TargetCell({ target }: { target: TargetRef }) {
  const isTunnel = target.reachability === 'tunnel'
  return (
    <div className="flex flex-col gap-0.5">
      <span className="flex items-center gap-1.5 text-foreground">
        {isTunnel ? (
          <Lock className="size-3.5 shrink-0 text-muted-foreground" aria-label="Private" />
        ) : (
          <Globe className="size-3.5 shrink-0 text-muted-foreground" aria-label="Public" />
        )}
        {target.name}
      </span>
      <span className="break-all font-mono text-xs text-muted-foreground">
        {targetAddress(target)}
      </span>
    </div>
  )
}
