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
  const selected = new Set((column.getFilterValue() as string[] | undefined) ?? [])

  // A single (or no) facet value can't filter anything — don't show the control.
  if (options.length <= 1) return null

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
                  <CommandItem
                    key={option.value}
                    onSelect={() => {
                      const next = new Set(selected)
                      if (isSelected) next.delete(option.value)
                      else next.add(option.value)
                      const values = [...next]
                      column.setFilterValue(values.length ? values : undefined)
                    }}
                  >
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
                    <span className="capitalize">{option.value}</span>
                    <span className="ml-auto font-mono text-xs text-muted-foreground">
                      {option.count}
                    </span>
                  </CommandItem>
                )
              })}
            </CommandGroup>
            {selected.size > 0 ? (
              <CommandGroup>
                <CommandItem
                  onSelect={() => column.setFilterValue(undefined)}
                  className="justify-center text-center"
                >
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
