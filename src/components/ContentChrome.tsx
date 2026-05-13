import { PanelRightClose, PanelRightOpen, Settings2 } from 'lucide-react'
import { DensityToggle } from '@/components/density/DensityToggle'
import { useRightRail } from '@/components/right-rail/RightRailProvider'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

interface ContentChromeProps {
  filter?: React.ReactNode
}

export function ContentChrome({ filter }: ContentChromeProps) {
  const { content, open, toggle } = useRightRail()
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
      {rightRailAvailable ? (
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={open ? 'Close properties panel' : 'Open properties panel'}
          aria-pressed={open}
          onClick={toggle}
        >
          {open ? <PanelRightClose aria-hidden /> : <PanelRightOpen aria-hidden />}
        </Button>
      ) : null}
    </div>
  )
}
