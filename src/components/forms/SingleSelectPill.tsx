import type { ReactNode } from 'react'
import { useState } from 'react'
import { PillButton } from '@/components/forms/PillPicker'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

interface SingleSelectPillProps<T> {
  label: string
  required?: boolean
  disabled?: boolean
  items: T[]
  selected: T | undefined
  getKey: (item: T) => string
  getPrimary: (item: T) => ReactNode
  getSecondary?: (item: T) => ReactNode
  onSelect: (item: T) => void
  emptyMessage?: string
  footer?: (close: () => void) => ReactNode
  popoverWidthClass?: string
}

export function SingleSelectPill<T>({
  label,
  required,
  disabled,
  items,
  selected,
  getKey,
  getPrimary,
  getSecondary,
  onSelect,
  emptyMessage,
  footer,
  popoverWidthClass = 'w-64',
}: SingleSelectPillProps<T>) {
  const [open, setOpen] = useState(false)
  const close = () => setOpen(false)
  const selectedKey = selected ? getKey(selected) : undefined

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <PillButton
            label={label}
            {...(selected ? { value: getPrimary(selected) } : {})}
            state={selected ? 'filled' : 'empty'}
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
              return (
                <li key={key}>
                  <button
                    type="button"
                    aria-current={key === selectedKey ? 'true' : undefined}
                    className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm hover:bg-muted aria-[current=true]:bg-muted/60"
                    onClick={() => {
                      onSelect(item)
                      close()
                    }}
                  >
                    <span>{getPrimary(item)}</span>
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
