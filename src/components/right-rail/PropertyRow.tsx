import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface PropertyRowProps {
  label: string
  children: ReactNode
  /** Monospace value rendering for slugs, ids, URLs. */
  mono?: boolean
}

/**
 * One row in a properties panel. Density-aware via `--form-row-py`.
 * DESIGN.md § 11 — chrome stays tight; the form-row density token applies
 * because property rows behave like form rows visually.
 */
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
