import type { LucideIcon } from 'lucide-react'
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
}

export const PillButton = forwardRef<HTMLButtonElement, PillButtonProps>(function PillButton(
  {
    label,
    value,
    state = value ? 'filled' : 'empty',
    icon: Icon,
    required,
    hint,
    className,
    type = 'button',
    onClick,
    ...props
  },
  ref,
) {
  const interactive = typeof onClick === 'function'
  const sharedClass = cn(
    'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium transition-colors duration-100',
    interactive
      ? 'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
      : 'cursor-default',
    state === 'empty' &&
      'border-dashed border-border bg-secondary text-muted-foreground hover:text-foreground',
    state === 'filled' && 'border-primary/30 bg-primary/10 text-primary hover:bg-primary/15',
    state === 'invalid' && 'border-destructive/30 bg-destructive/10 text-destructive',
    className,
  )
  const content = (
    <>
      {Icon ? <Icon className="size-3" aria-hidden /> : null}
      <span className="text-muted-foreground/80">{label}:</span>
      <span className="text-foreground">
        {value ?? (
          <span className="italic text-muted-foreground/70">{required ? 'Required' : 'Set'}</span>
        )}
      </span>
      {hint ? <span className="text-muted-foreground/70">{hint}</span> : null}
    </>
  )
  if (!interactive) {
    return (
      <span data-state={state} className={sharedClass}>
        {content}
      </span>
    )
  }
  return (
    <button
      ref={ref}
      type={type}
      onClick={onClick}
      data-state={state}
      className={sharedClass}
      {...props}
    >
      {content}
    </button>
  )
})
