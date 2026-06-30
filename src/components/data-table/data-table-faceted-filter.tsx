import type { Column } from '@tanstack/react-table'
import { Check, ListFilter } from 'lucide-react'
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
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

export interface FacetOption {
  value: string
  label?: string
  count?: number
}

// The shared faceted multi-select control. Used in two ways: bound to a
// react-table column (client-side lists), or standalone with explicit options +
// value/onChange (server-filtered lists like Runs). Same chrome either way.
function FacetedFilterControl({
  title,
  options,
  selected,
  onToggle,
  onClear,
}: {
  title: string
  options: FacetOption[]
  selected: Set<string>
  onToggle: (value: string) => void
  onClear: () => void
}) {
  return (
    <Popover>
      <PopoverTrigger render={<Button variant="outline" size="sm" className="h-8 border-dashed" />}>
        <ListFilter className="size-4" />
        {title}
        {selected.size > 0 ? (
          <>
            <Separator orientation="vertical" className="mx-1 h-4" />
            <Badge variant="secondary" className="rounded-sm px-1 font-normal">
              {selected.size}
            </Badge>
          </>
        ) : null}
      </PopoverTrigger>
      <PopoverContent className="w-52 p-0" align="start">
        <Command>
          <CommandInput placeholder={title} />
          <CommandList>
            <CommandEmpty>No options.</CommandEmpty>
            <CommandGroup>
              {options.map((option) => {
                const isSelected = selected.has(option.value)
                return (
                  <CommandItem key={option.value} onSelect={() => onToggle(option.value)}>
                    <div
                      className={cn(
                        'flex size-4 items-center justify-center rounded-sm border border-primary',
                        isSelected
                          ? 'bg-primary text-primary-foreground'
                          : 'opacity-50 [&_svg]:invisible',
                      )}
                    >
                      <Check className="size-3" />
                    </div>
                    <span className="capitalize">{option.label ?? option.value}</span>
                    {option.count !== undefined ? (
                      <span className="ml-auto font-mono text-xs text-muted-foreground">
                        {option.count}
                      </span>
                    ) : null}
                  </CommandItem>
                )
              })}
            </CommandGroup>
            {selected.size > 0 ? (
              <CommandGroup>
                <CommandItem onSelect={onClear} className="justify-center text-center">
                  Clear filter
                </CommandItem>
              </CommandGroup>
            ) : null}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

// Bound to a react-table column: options + selection derived from the table.
export function DataTableFacetedFilter<TData, TValue>({
  column,
  title,
}: {
  column: Column<TData, TValue>
  title: string
}) {
  const facets = column.getFacetedUniqueValues()
  const options = [...facets.entries()]
    .map(([value, count]) => ({ value: String(value), count }))
    .filter((o) => o.value)
    .sort((a, b) => a.value.localeCompare(b.value))
  // A single (or no) facet value can't filter anything — don't show the control.
  if (options.length <= 1) return null
  const selected = new Set((column.getFilterValue() as string[] | undefined) ?? [])
  return (
    <FacetedFilterControl
      title={title}
      options={options}
      selected={selected}
      onToggle={(v) => {
        const next = new Set(selected)
        if (next.has(v)) next.delete(v)
        else next.add(v)
        column.setFilterValue(next.size ? [...next] : undefined)
      }}
      onClear={() => column.setFilterValue(undefined)}
    />
  )
}

// Standalone: explicit options + controlled value (for server-filtered lists).
export function FacetedFilter({
  title,
  options,
  value,
  onChange,
}: {
  title: string
  options: FacetOption[]
  value: string[]
  onChange: (next: string[]) => void
}) {
  const selected = new Set(value)
  return (
    <FacetedFilterControl
      title={title}
      options={options}
      selected={selected}
      onToggle={(v) => {
        const next = new Set(selected)
        if (next.has(v)) next.delete(v)
        else next.add(v)
        onChange([...next])
      }}
      onClear={() => onChange([])}
    />
  )
}
