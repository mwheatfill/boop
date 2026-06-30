import type { ComponentType, ReactNode } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

// The unit of grouping inside an editor/detail surface: a card with an
// icon-anchored title + optional hint, then content. Cards give each section
// clear separation in a tall sheet. See docs/ui-craft.md.
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
    <Card size="sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {Icon ? <Icon className="size-4 shrink-0 text-muted-foreground" /> : null}
          {title}
        </CardTitle>
        {hint ? <CardDescription>{hint}</CardDescription> : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">{children}</CardContent>
    </Card>
  )
}
