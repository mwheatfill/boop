import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface PropertyRowProps {
  label: string
  children: ReactNode
  mono?: boolean
}

export function PropertyRow({ label, children, mono }: PropertyRowProps) {
  return (
    <div className="flex flex-col gap-1 border-b border-border/40 py-(--form-row-py) last:border-b-0">
      <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span className={cn('text-sm break-words', mono && 'font-mono')}>{children}</span>
    </div>
  )
}
