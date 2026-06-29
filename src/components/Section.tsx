import type { ComponentType, ReactNode } from 'react'

// The unit of grouping inside an editor/detail surface: an icon-anchored
// uppercase header, an optional hint, then content. See docs/ui-craft.md.
export function Section({
  icon: Icon,
  title,
  hint,
  children,
}: {
  icon?: ComponentType<{ className?: string }>
  title: string
  hint?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2 text-muted-foreground">
          {Icon ? <Icon className="size-4" /> : null}
          <h3 className="font-medium text-xs uppercase tracking-wide">{title}</h3>
        </div>
        {hint ? <p className="text-muted-foreground text-xs leading-relaxed">{hint}</p> : null}
      </div>
      {children}
    </section>
  )
}
