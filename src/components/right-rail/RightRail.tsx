import { PanelRightClose } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useRightRail } from './RightRailProvider'
import { useRightRailContent } from './useRightRailContent'

/**
 * Per-route properties panel. Rendered at the right edge of the workspace,
 * adjacent to `<SidebarInset>`. Per DESIGN.md § 5 the rail is flat-edged
 * (no border-radius on data surfaces) and separates from the content
 * column with a single hairline border on the left.
 *
 * The rail uses a controlled, viewport-aware mount rather than the shadcn
 * Sidebar primitive's second instance — the primitive's SidebarProvider
 * is single-state and would conflict with the left sidebar's open state.
 * Mobile renders nothing (PRD #44 § "Right rail" story 26).
 */
export function RightRail() {
  const content = useRightRailContent()
  const { open, toggle } = useRightRail()

  if (!content) return null
  if (!open) return null

  return (
    <aside
      data-slot="right-rail"
      className="hidden w-80 shrink-0 flex-col border-l border-border bg-card md:flex"
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
