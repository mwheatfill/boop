// shadcn-shape Card. Add more shadcn components with `npx shadcn@latest add <name>`.
//
// React 19 ref-as-prop: no React.forwardRef, no displayName. `ref` is just
// another prop. Keep it that way for any new components added to this dir.
import type { ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils'

export function Card({ className, ...props }: ComponentPropsWithoutRef<'div'>) {
  return (
    <div
      className={cn('rounded-lg border border-border bg-card text-card-foreground', className)}
      {...props}
    />
  )
}

export function CardHeader({ className, ...props }: ComponentPropsWithoutRef<'div'>) {
  return <div className={cn('flex flex-col gap-1.5 p-4', className)} {...props} />
}

export function CardTitle({ className, ...props }: ComponentPropsWithoutRef<'h3'>) {
  return <h3 className={cn('font-semibold leading-none tracking-tight', className)} {...props} />
}

export function CardDescription({ className, ...props }: ComponentPropsWithoutRef<'p'>) {
  return <p className={cn('text-sm text-muted-foreground', className)} {...props} />
}

export function CardContent({ className, ...props }: ComponentPropsWithoutRef<'div'>) {
  return <div className={cn('p-4 pt-0', className)} {...props} />
}

export function CardFooter({ className, ...props }: ComponentPropsWithoutRef<'div'>) {
  return <div className={cn('flex items-center p-4 pt-0', className)} {...props} />
}
