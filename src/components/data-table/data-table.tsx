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
  type ColumnOrderState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  type Header,
  type SortingState,
  useReactTable,
  type VisibilityState,
} from '@tanstack/react-table'
import {
  AlignJustify,
  ArrowDown,
  ArrowUp,
  ChevronsUpDown,
  GripVertical,
  Search,
} from 'lucide-react'
import { type CSSProperties, type ReactNode, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { DataTableViewOptions } from './data-table-view-options'
import { DataTableViews } from './data-table-views'
import type { TableViewState } from './use-table-views'

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
  const [globalFilter, setGlobalFilter] = useState('')
  const [density, setDensity] = useState<'compact' | 'spacious'>('compact')

  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnVisibility, columnOrder, globalFilter },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnOrderChange: setColumnOrder,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })

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
  const pad = density === 'compact' ? 'px-3 py-1.5' : 'px-3 py-3'

  const capture = (): TableViewState => ({
    columnVisibility,
    columnOrder,
    sorting: sorting.map((s) => ({ id: s.id, desc: s.desc })),
  })
  const apply = (s: TableViewState) => {
    setColumnVisibility(s.columnVisibility ?? {})
    setColumnOrder(s.columnOrder ?? columns.map(columnId).filter(Boolean))
    setSorting(s.sorting ?? [])
  }

  return (
    <div className="flex flex-col gap-3" data-density={density}>
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
        <div className="ml-auto flex items-center gap-2">
          {gridKey ? <DataTableViews gridKey={gridKey} capture={capture} apply={apply} /> : null}
          <DataTableViewOptions table={table} />
          <Button
            variant="outline"
            size="icon-sm"
            aria-label={density === 'compact' ? 'Use spacious rows' : 'Use compact rows'}
            onClick={() => setDensity((d) => (d === 'compact' ? 'spacious' : 'compact'))}
          >
            <AlignJustify className="size-4" />
          </Button>
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
