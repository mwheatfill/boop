import { PanelRightClose } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useRightRail } from './RightRailProvider'

export function RightRail() {
  const { content, open, toggle } = useRightRail()
  if (!content || !open) return null

  return (
    <aside
      data-slot="right-rail"
      className="hidden w-(--right-rail-width) shrink-0 flex-col border-l border-border bg-card md:flex"
      aria-label={content.title}
    >
      <header className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {content.title}
        </p>
        <Button variant="ghost" size="icon-sm" aria-label="Close properties panel" onClick={toggle}>
          <PanelRightClose aria-hidden />
        </Button>
      </header>
      <div className="flex-1 overflow-y-auto py-2">{content.body}</div>
    </aside>
  )
}
