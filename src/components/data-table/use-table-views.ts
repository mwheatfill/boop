import { useCallback } from 'react'
import { useLocalStorage } from '@/lib/use-local-storage'

// The subset of TanStack Table v8 state a saved View persists. Device-local only
// (no server), mirroring the Cmd+K recents storage policy in DESIGN.md § 4.
export interface TableViewState {
  columnVisibility?: Record<string, boolean>
  columnOrder?: string[]
  sorting?: Array<{ id: string; desc: boolean }>
  columnFilters?: Array<{ id: string; value: unknown }>
}

export interface SavedTableView {
  name: string
  state: TableViewState
}

function parseViews(raw: unknown): SavedTableView[] | null {
  if (!Array.isArray(raw)) return null
  return raw.every(
    (v) => v && typeof v === 'object' && typeof (v as SavedTableView).name === 'string',
  )
    ? (raw as SavedTableView[])
    : null
}

export interface UseTableViewsResult {
  views: SavedTableView[]
  saveView: (name: string, state: TableViewState) => void
  deleteView: (name: string) => void
}

// Saved Views for one grid, keyed by an opaque grid id (e.g. "jobs", "channels").
export function useTableViews(gridKey: string): UseTableViewsResult {
  const [views, setViews] = useLocalStorage<SavedTableView[]>(`table-views:${gridKey}`, [], {
    parse: parseViews,
  })

  const saveView = useCallback(
    (name: string, state: TableViewState) => {
      const trimmed = name.trim()
      if (!trimmed) return
      setViews((prev) => [...prev.filter((v) => v.name !== trimmed), { name: trimmed, state }])
    },
    [setViews],
  )

  const deleteView = useCallback(
    (name: string) => setViews((prev) => prev.filter((v) => v.name !== name)),
    [setViews],
  )

  return { views, saveView, deleteView }
}
