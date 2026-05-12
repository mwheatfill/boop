import { Check } from 'lucide-react'
import type { ReactNode } from 'react'
import { useState } from 'react'
import { PillButton } from '@/components/forms/PillPicker'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

interface MultiSelectPillProps<T> {
  label: string
  required?: boolean
  disabled?: boolean
  items: T[]
  selectedKeys: readonly string[]
  getKey: (item: T) => string
  getPrimary: (item: T) => ReactNode
  getSecondary?: (item: T) => ReactNode
  onToggle: (item: T) => void
  emptyMessage?: string
  footer?: (close: () => void) => ReactNode
  popoverWidthClass?: string
}

export function MultiSelectPill<T>({
  label,
  required,
  disabled,
  items,
  selectedKeys,
  getKey,
  getPrimary,
  getSecondary,
  onToggle,
  emptyMessage,
  footer,
  popoverWidthClass = 'w-72',
}: MultiSelectPillProps<T>) {
  const [open, setOpen] = useState(false)
  const close = () => setOpen(false)
  const selectedSet = new Set(selectedKeys)
  function summaryNode(): ReactNode {
    if (selectedKeys.length === 0) return undefined
    if (selectedKeys.length === 1) {
      const single = items.find((i) => getKey(i) === selectedKeys[0])
      return single ? getPrimary(single) : selectedKeys[0]
    }
    return `${selectedKeys.length} selected`
  }
  const summary = summaryNode()

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <PillButton
            label={label}
            value={summary}
            state={selectedKeys.length === 0 ? 'empty' : 'filled'}
            {...(required ? { required: true } : {})}
            {...(disabled ? { disabled: true } : {})}
          />
        }
      />
      <PopoverContent className={`${popoverWidthClass} p-1`}>
        {items.length === 0 ? (
          emptyMessage ? (
            <p className="px-2 py-2 text-xs text-muted-foreground">{emptyMessage}</p>
          ) : null
        ) : (
          <ul className="flex max-h-64 flex-col gap-px overflow-y-auto">
            {items.map((item) => {
              const key = getKey(item)
              const isSelected = selectedSet.has(key)
              return (
                <li key={key}>
                  <button
                    type="button"
                    aria-pressed={isSelected}
                    className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm hover:bg-muted aria-pressed:bg-muted/60"
                    onClick={() => onToggle(item)}
                  >
                    <span className="flex items-center gap-2">
                      <span className="inline-flex size-4 items-center justify-center rounded border border-border">
                        {isSelected ? <Check className="size-3 text-primary" aria-hidden /> : null}
                      </span>
                      <span>{getPrimary(item)}</span>
                    </span>
                    {getSecondary ? (
                      <span className="font-mono text-xs text-muted-foreground">
                        {getSecondary(item)}
                      </span>
                    ) : null}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
        {footer ? <div className="mt-1 border-t border-border pt-1">{footer(close)}</div> : null}
      </PopoverContent>
    </Popover>
  )
}
