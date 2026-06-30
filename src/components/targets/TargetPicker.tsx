import { Check, ChevronsUpDown } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import type { Target } from '@/shared/schemas/target'
import { TargetOption } from './TargetOption'

export function TargetPicker({
  targets,
  value,
  onChange,
}: {
  targets: Target[]
  value: string
  onChange: (slug: string) => void
}) {
  const [open, setOpen] = useState(false)
  const selected = targets.find((t) => t.slug === value)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="h-auto min-h-9 w-full justify-between gap-2 py-2 font-normal"
          />
        }
      >
        {selected ? (
          <TargetOption target={selected} />
        ) : (
          <span className="flex-1 text-left text-muted-foreground">Select a Target</span>
        )}
        <ChevronsUpDown className="size-4 shrink-0 self-center text-muted-foreground" aria-hidden />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--anchor-width)] min-w-72 p-0">
        <Command>
          <CommandInput placeholder="Search Targets…" />
          <CommandList>
            <CommandEmpty>No Targets.</CommandEmpty>
            <CommandGroup>
              {targets.map((t) => (
                <CommandItem
                  key={t.slug}
                  value={t.name}
                  onSelect={() => {
                    onChange(t.slug)
                    setOpen(false)
                  }}
                  className="items-start gap-2"
                >
                  <TargetOption target={t} />
                  <Check
                    className={cn(
                      'mt-0.5 size-4 shrink-0',
                      value === t.slug ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
