import { Check, ChevronsUpDown } from 'lucide-react'
import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
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
import { TargetHealthBadge } from './TargetHealthBadge'

function targetAddress(t: Pick<Target, 'reachability' | 'url' | 'internalOrigin'>): string {
  return (t.reachability === 'tunnel' ? t.internalOrigin : t.url) || '—'
}

// A combobox-style Target picker: the trigger shows just the name; each option
// carries its context (method, Public/Private, health, address) so you have it
// while choosing.
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
            className="w-full justify-between font-normal"
          />
        }
      >
        {selected ? selected.name : <span className="text-muted-foreground">Select a Target</span>}
        <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
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
                  className="items-start"
                >
                  <div className="flex flex-1 flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">{t.name}</span>
                      <Check
                        className={cn(
                          'ml-auto size-4',
                          value === t.slug ? 'opacity-100' : 'opacity-0',
                        )}
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant="secondary">{t.method}</Badge>
                      <Badge variant="outline">
                        {t.reachability === 'tunnel' ? 'Private' : 'Public'}
                      </Badge>
                      {t.health ? <TargetHealthBadge health={t.health} /> : null}
                    </div>
                    <span className="break-all font-mono text-xs text-muted-foreground">
                      {targetAddress(t)}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
