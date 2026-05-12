import { PanelRightClose, PanelRightOpen, Settings2 } from 'lucide-react'
import { DensityToggle } from '@/components/density/DensityToggle'
import { useRightRail } from '@/components/right-rail/RightRailProvider'
import { useRightRailContent } from '@/components/right-rail/useRightRailContent'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

/**
 * Three-icon cluster top-right of list / detail views.
 * Per DESIGN.md § 4 / § 5: filter / display options / right-rail toggle.
 *
 * Filter is opt-in: callers that have their own filter chip surface
 * (e.g., /runs) pass their own trigger; otherwise the slot is omitted.
 * Display options popover hosts the density toggle (and future column
 * visibility controls). Right-rail toggle reflects open/closed state.
 *
 * The cluster itself is a rounded floating affordance — `rounded-md` is
 * appropriate here per DESIGN.md § 5 (radius only on buttons / floating
 * surfaces, not on data containers).
 */
interface ContentChromeProps {
  filter?: React.ReactNode
}

export function ContentChrome({ filter }: ContentChromeProps) {
  const { open, toggle } = useRightRail()
  const content = useRightRailContent()
  const rightRailAvailable = content !== null

  return (
    <div
      data-slot="content-chrome"
      className="inline-flex items-center gap-0.5 rounded-md border border-border bg-card p-0.5"
    >
      {filter ?? null}
      <Popover>
        <PopoverTrigger
          render={
            <Button variant="ghost" size="icon-sm" aria-label="Display options">
              <Settings2 aria-hidden />
            </Button>
          }
        />
        <PopoverContent className="w-56" align="end">
          <DensityToggle />
        </PopoverContent>
      </Popover>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={
          rightRailAvailable
            ? open
              ? 'Close properties panel'
              : 'Open properties panel'
            : 'Properties panel not available on this view'
        }
        aria-pressed={open}
        disabled={!rightRailAvailable}
        onClick={toggle}
      >
        {open ? <PanelRightClose aria-hidden /> : <PanelRightOpen aria-hidden />}
      </Button>
    </div>
  )
}
