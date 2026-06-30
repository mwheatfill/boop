import { Bookmark, X } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { type TableViewState, useTableViews } from './use-table-views'

export function DataTableViews({
  gridKey,
  capture,
  apply,
}: {
  gridKey: string
  capture: () => TableViewState
  apply: (state: TableViewState) => void
}) {
  const { views, saveView, deleteView } = useTableViews(gridKey)
  const [name, setName] = useState('')
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<Button variant="outline" size="sm" className="h-8" />}>
        <Bookmark className="size-4" /> Views{views.length ? ` (${views.length})` : ''}
      </PopoverTrigger>
      <PopoverContent align="end" className="flex w-64 flex-col gap-2 p-2">
        <div className="flex gap-1.5">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Save current as…"
            className="h-8"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && name.trim()) {
                saveView(name, capture())
                setName('')
              }
            }}
          />
          <Button
            size="sm"
            disabled={!name.trim()}
            onClick={() => {
              saveView(name, capture())
              setName('')
            }}
          >
            Save
          </Button>
        </div>
        {views.length === 0 ? (
          <p className="px-1 py-1.5 text-xs text-muted-foreground">No saved views yet.</p>
        ) : (
          <div className="flex flex-col">
            {views.map((view) => (
              <div
                key={view.name}
                className="group flex items-center gap-1 rounded-sm hover:bg-accent"
              >
                <button
                  type="button"
                  className="flex-1 truncate px-2 py-1.5 text-left text-sm"
                  onClick={() => {
                    apply(view.state)
                    setOpen(false)
                  }}
                >
                  {view.name}
                </button>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="opacity-0 group-hover:opacity-100"
                  aria-label={`Delete view ${view.name}`}
                  onClick={() => deleteView(view.name)}
                >
                  <X className="size-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
