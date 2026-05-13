import { Plus, Trash2 } from 'lucide-react'
import { useId, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { isValidVariableName, VARIABLE_CONSTRAINTS } from '@/shared/schemas/customer-variables'

export type VariableSource = 'customer' | 'override' | 'job'

export interface KeyValueRow {
  name: string
  value: string
  source?: VariableSource
  inherited?: { from: 'customer'; value: string }
}

interface KeyValueListEditorProps {
  rows: KeyValueRow[]
  onChange: (next: KeyValueRow[]) => void
  readOnly?: boolean
  emptyHint?: string
  addLabel?: string
}

function sourceTag(row: KeyValueRow): string | null {
  if (!row.source) return null
  if (row.source === 'customer') return 'from Customer'
  if (row.source === 'override') return 'override'
  return 'Job-only'
}

export function KeyValueListEditor({
  rows,
  onChange,
  readOnly = false,
  emptyHint,
  addLabel = 'Add variable',
}: KeyValueListEditorProps) {
  const groupId = useId()
  const [errorRow, setErrorRow] = useState<number | null>(null)

  const canAdd = useMemo(
    () => !readOnly && rows.length < VARIABLE_CONSTRAINTS.maxKeys,
    [readOnly, rows.length],
  )

  function update(index: number, patch: Partial<KeyValueRow>) {
    const next = rows.map((r, i) => (i === index ? { ...r, ...patch } : r))
    onChange(next)
    if (errorRow === index) setErrorRow(null)
  }

  function remove(index: number) {
    onChange(rows.filter((_, i) => i !== index))
    if (errorRow === index) setErrorRow(null)
  }

  function add() {
    onChange([...rows, { name: '', value: '' }])
  }

  function validateName(index: number, name: string) {
    if (name.length === 0) return
    if (!isValidVariableName(name)) {
      setErrorRow(index)
      return
    }
    const dup = rows.findIndex((r, i) => i !== index && r.name === name)
    if (dup !== -1) {
      setErrorRow(index)
      return
    }
    setErrorRow(null)
  }

  if (rows.length === 0 && readOnly) {
    return <p className="text-xs text-muted-foreground">{emptyHint ?? 'No variables defined.'}</p>
  }

  return (
    <div className="flex flex-col gap-2">
      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">{emptyHint ?? 'No variables yet.'}</p>
      ) : (
        <ul className="flex flex-col gap-1.5" aria-label="Variables">
          {rows.map((row, i) => {
            const tag = sourceTag(row)
            const rowId = `${groupId}-${i}`
            return (
              <li key={rowId} className="flex items-center gap-2">
                <Input
                  id={`${rowId}-name`}
                  aria-label="Name"
                  value={row.name}
                  onChange={(e) => update(i, { name: e.currentTarget.value })}
                  onBlur={(e) => validateName(i, e.currentTarget.value)}
                  placeholder="tenant_id"
                  readOnly={readOnly || row.source === 'customer'}
                  className="h-7 w-40 font-mono text-xs"
                  aria-invalid={errorRow === i ? 'true' : undefined}
                />
                <Input
                  id={`${rowId}-value`}
                  aria-label="Value"
                  value={row.value}
                  onChange={(e) => update(i, { value: e.currentTarget.value })}
                  placeholder="acme-123"
                  readOnly={readOnly}
                  className="h-7 flex-1 font-mono text-xs"
                />
                {tag ? (
                  <span className="rounded-md bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                    {tag}
                  </span>
                ) : null}
                {readOnly || row.source === 'customer' ? null : (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove ${row.name || 'variable'}`}
                    onClick={() => remove(i)}
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                  </Button>
                )}
              </li>
            )
          })}
        </ul>
      )}
      {errorRow !== null ? (
        <p className="text-xs text-destructive">
          Names must match {VARIABLE_CONSTRAINTS.namePattern.source} and be unique within this
          scope.
        </p>
      ) : null}
      {canAdd ? (
        <Button type="button" variant="ghost" size="sm" className="self-start" onClick={add}>
          <Plus className="size-3.5" aria-hidden />
          {addLabel}
        </Button>
      ) : null}
    </div>
  )
}

export function variableMapToRows(map: Record<string, string>): KeyValueRow[] {
  return Object.entries(map)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, value]) => ({ name, value }))
}

export function rowsToVariableMap(rows: KeyValueRow[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const row of rows) {
    if (row.name.length === 0) continue
    if (!isValidVariableName(row.name)) continue
    out[row.name] = row.value
  }
  return out
}
