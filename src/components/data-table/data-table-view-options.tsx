import type { Column, Table } from '@tanstack/react-table'
import { SlidersHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

function columnLabel<TData>(column: Column<TData>): string {
  const meta = column.columnDef.meta as { label?: string } | undefined
  if (meta?.label) return meta.label
  const header = column.columnDef.header
  return typeof header === 'string' ? header : column.id
}

export function DataTableViewOptions<TData>({ table }: { table: Table<TData> }) {
  const columns = table.getAllColumns().filter((c) => c.getCanHide())
  return (
    <Popover>
      <PopoverTrigger render={<Button variant="outline" size="sm" className="h-8" />}>
        <SlidersHorizontal className="size-4" /> Columns
      </PopoverTrigger>
      <PopoverContent align="end" className="w-52 p-1">
        <div className="flex flex-col">
          {columns.map((column) => (
            <label
              key={column.id}
              className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
            >
              <Checkbox
                checked={column.getIsVisible()}
                onCheckedChange={(value) => column.toggleVisibility(!!value)}
              />
              {columnLabel(column)}
            </label>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
