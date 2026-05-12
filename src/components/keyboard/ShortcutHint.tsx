import { Tooltip as TooltipPrimitive } from '@base-ui/react/tooltip'
import type { ReactNode } from 'react'
import { renderKeyCombo } from '@/lib/keyboard/key-combo'

interface ShortcutHintProps {
  combo: string
  children: ReactNode
  delay?: number
}

export function ShortcutHint({ combo, children, delay = 500 }: ShortcutHintProps) {
  const tokens = renderKeyCombo(combo)
  return (
    <TooltipPrimitive.Provider delay={delay}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger render={children as never} />
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Positioner side="top" sideOffset={6} className="isolate z-50">
            <TooltipPrimitive.Popup className="flex items-center gap-1 rounded-md border border-border bg-secondary px-2 py-1 text-xs text-secondary-foreground shadow-md ring-1 ring-foreground/10">
              {tokens.map((t) => (
                <kbd key={`${combo}-${t}`} className="rounded-sm bg-muted px-1 font-mono">
                  {t}
                </kbd>
              ))}
            </TooltipPrimitive.Popup>
          </TooltipPrimitive.Positioner>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  )
}
