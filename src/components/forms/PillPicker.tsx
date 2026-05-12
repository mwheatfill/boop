import type { LucideIcon } from 'lucide-react'
import { ChevronDown } from 'lucide-react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

export type PillState = 'empty' | 'filled' | 'invalid'

interface PillButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'value'> {
  label: string
  value?: ReactNode
  state?: PillState
  icon?: LucideIcon
  required?: boolean
  hint?: ReactNode
  expanded?: boolean
}

export const PillButton = forwardRef<HTMLButtonElement, PillButtonProps>(function PillButton(
  {
    label,
    value,
    state = value ? 'filled' : 'empty',
    icon: Icon,
    required,
    hint,
    expanded,
    className,
    type = 'button',
    ...props
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      data-state={state}
      data-expanded={expanded ? 'true' : undefined}
      aria-expanded={expanded}
      className={cn(
        'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium transition-colors duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        state === 'empty' &&
          'border-dashed border-border bg-secondary text-muted-foreground hover:text-foreground',
        state === 'filled' && 'border-primary/30 bg-primary/10 text-primary hover:bg-primary/15',
        state === 'invalid' && 'border-destructive/30 bg-destructive/10 text-destructive',
        className,
      )}
      {...props}
    >
      {Icon ? <Icon className="size-3" aria-hidden /> : null}
      <span className="text-muted-foreground/80">{label}:</span>
      <span className="text-foreground">
        {value ?? (
          <span className="italic text-muted-foreground/70">{required ? 'Required' : 'Set'}</span>
        )}
      </span>
      {hint ? <span className="text-muted-foreground/70">{hint}</span> : null}
      <ChevronDown className="size-3 opacity-60" aria-hidden />
    </button>
  )
})
