import type { RowData } from '@tanstack/react-table'

// Per-column metadata the DataTable reads: a human label (Columns menu, filter
// title) and an optional faceted filter. See docs/ui-craft.md.
declare module '@tanstack/react-table' {
  interface ColumnMeta<TData extends RowData, TValue> {
    label?: string
    filterVariant?: 'select'
  }
}
