import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { restrictToHorizontalAxis } from '@dnd-kit/modifiers'
import {
  arrayMove,
  horizontalListSortingStrategy,
  SortableContext,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  type ColumnDef,
  type ColumnFiltersState,
  type ColumnOrderState,
  type FilterFn,
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getSortedRowModel,
  type Header,
  type SortingState,
  useReactTable,
  type VisibilityState,
} from '@tanstack/react-table'
import { ArrowDown, ArrowUp, ChevronsUpDown, GripVertical, Search, X } from 'lucide-react'
import { type CSSProperties, type ReactNode, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { DataTableFacetedFilter } from './data-table-faceted-filter'
import { DataTableViewOptions } from './data-table-view-options'
import { DataTableViews } from './data-table-views'
import './types'
import type { TableViewState } from './use-table-views'

// Multi-select facet: keep rows whose value is in the chosen set. The table default
// for every column; only flagged (meta.filterVariant) columns expose a filter UI.
const facetedFilterFn: FilterFn<unknown> = (row, columnId, filterValue) => {
  if (!Array.isArray(filterValue) || filterValue.length === 0) return true
  return filterValue.includes(String(row.getValue(columnId)))
}

function columnId<TData, TValue>(col: ColumnDef<TData, TValue>): string {
  if (col.id) return col.id
  if ('accessorKey' in col && typeof col.accessorKey === 'string') return col.accessorKey
  return ''
}

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  emptyState?: ReactNode
  onRowClick?: (row: TData) => void
  /** When set, a device-local saved-Views menu is shown for this grid. */
  gridKey?: string
  searchPlaceholder?: string
}

export function DataTable<TData, TValue>({
  columns,
  data,
  emptyState,
  onRowClick,
  gridKey,
  searchPlaceholder = 'Search…',
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [columnOrder, setColumnOrder] = useState<ColumnOrderState>(() =>
    columns.map(columnId).filter(Boolean),
  )
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [globalFilter, setGlobalFilter] = useState('')

  const table = useReactTable({
    data,
    columns,
    defaultColumn: { filterFn: facetedFilterFn as FilterFn<TData> },
    state: { sorting, columnVisibility, columnOrder, columnFilters, globalFilter },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnOrderChange: setColumnOrder,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  })

  const filterColumns = table
    .getAllColumns()
    .filter((c) => c.columnDef.meta?.filterVariant === 'select' && c.getCanFilter())

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  )
  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (over && active.id !== over.id) {
      setColumnOrder((prev) => {
        const from = prev.indexOf(String(active.id))
        const to = prev.indexOf(String(over.id))
        return from < 0 || to < 0 ? prev : arrayMove(prev, from, to)
      })
    }
  }

  const rows = table.getRowModel().rows
  const pad = 'px-3 py-3'

  const capture = (): TableViewState => ({
    columnVisibility,
    columnOrder,
    sorting: sorting.map((s) => ({ id: s.id, desc: s.desc })),
    columnFilters: columnFilters.map((f) => ({ id: f.id, value: f.value })),
  })
  const apply = (s: TableViewState) => {
    setColumnVisibility(s.columnVisibility ?? {})
    setColumnOrder(s.columnOrder ?? columns.map(columnId).filter(Boolean))
    setSorting(s.sorting ?? [])
    setColumnFilters((s.columnFilters as ColumnFiltersState | undefined) ?? [])
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder={searchPlaceholder}
            className="h-8 w-56 pl-8"
          />
        </div>
        {filterColumns.map((column) => (
          <DataTableFacetedFilter
            key={column.id}
            column={column}
            title={column.columnDef.meta?.label ?? column.id}
          />
        ))}
        {columnFilters.length > 0 ? (
          <Button variant="ghost" size="sm" className="h-8" onClick={() => setColumnFilters([])}>
            Reset <X className="size-4" />
          </Button>
        ) : null}
        <div className="ml-auto flex items-center gap-2">
          {gridKey ? <DataTableViews gridKey={gridKey} capture={capture} apply={apply} /> : null}
          <DataTableViewOptions table={table} />
          <span className="text-xs text-muted-foreground">
            {rows.length} {rows.length === 1 ? 'row' : 'rows'}
          </span>
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[restrictToHorizontalAxis]}
        onDragEnd={onDragEnd}
      >
        <div className="relative max-h-[calc(100vh-220px)] overflow-auto rounded-md border border-border">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-background">
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id} className="border-b border-border">
                  <SortableContext items={columnOrder} strategy={horizontalListSortingStrategy}>
                    {hg.headers.map((header) => (
                      <HeaderCell key={header.id} header={header} pad={pad} />
                    ))}
                  </SortableContext>
                </tr>
              ))}
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={table.getVisibleLeafColumns().length} className="h-24 text-center">
                    {emptyState ?? <span className="text-muted-foreground">Nothing here yet.</span>}
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr
                    key={row.id}
                    className={cn(
                      'border-b border-border last:border-0 hover:bg-muted/40',
                      onRowClick && 'cursor-pointer',
                    )}
                    tabIndex={onRowClick ? 0 : undefined}
                    onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                    onKeyDown={
                      onRowClick
                        ? (e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              onRowClick(row.original)
                            }
                          }
                        : undefined
                    }
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className={cn(pad, 'align-middle')}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </DndContext>
    </div>
  )
}

function HeaderCell<TData, TValue>({
  header,
  pad,
}: {
  header: Header<TData, TValue>
  pad: string
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: header.column.id,
  })
  const style: CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    ...(isDragging ? { zIndex: 3, opacity: 0.85 } : {}),
  }
  const sorted = header.column.getIsSorted()
  const headerDef = header.column.columnDef.header
  return (
    <th
      ref={setNodeRef}
      style={style}
      className={cn(pad, 'group/th whitespace-nowrap text-left font-medium text-muted-foreground')}
    >
      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-label="Drag to reorder column"
          className="-ml-1 shrink-0 cursor-grab text-muted-foreground opacity-0 transition-opacity group-hover/th:opacity-100"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-3.5" />
        </button>
        {header.isPlaceholder ? null : header.column.getCanSort() &&
          typeof headerDef === 'string' ? (
          <button
            type="button"
            onClick={() => header.column.toggleSorting(sorted === 'asc')}
            className="flex items-center gap-1 hover:text-foreground data-[active=true]:text-foreground"
            data-active={!!sorted}
          >
            {headerDef}
            {sorted === 'asc' ? (
              <ArrowUp className="size-3.5" />
            ) : sorted === 'desc' ? (
              <ArrowDown className="size-3.5" />
            ) : (
              <ChevronsUpDown className="size-3.5 opacity-50" />
            )}
          </button>
        ) : (
          flexRender(headerDef, header.getContext())
        )}
      </div>
    </th>
  )
}
