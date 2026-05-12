'use client'
import { Combobox } from '@base-ui/react/combobox'
import { Check, ChevronDown, X } from 'lucide-react'
import { forwardRef, type ReactNode, useMemo, useState } from 'react'
import {
  ComboboxCreateRow,
  ComboboxSection,
  isExactMatch,
  partitionByQuery,
} from '@/components/forms/combobox-internals'
import type { SearchableComboboxProps } from '@/components/forms/SearchableCombobox'
import { cn } from '@/lib/utils'

const MAX_INLINE_CHIPS = 3

export interface MultiSearchableComboboxProps<T>
  extends Omit<SearchableComboboxProps<T>, 'value' | 'onValueChange' | 'renderRow'> {
  value: readonly T[]
  onValueChange: (value: T[]) => void
}

interface MultiPillTriggerProps<T> {
  label: string
  selected: readonly T[]
  getId: (item: T) => string
  getLabel: (item: T) => string
  onRemove: (item: T) => void
  state: 'empty' | 'filled' | 'invalid'
  required: boolean
  disabled: boolean
  expanded: boolean
}

const MultiPillTrigger = forwardRef<HTMLButtonElement, MultiPillTriggerProps<unknown>>(
  function MultiPillTrigger(
    { label, selected, getId, getLabel, onRemove, state, required, disabled, expanded, ...props },
    ref,
  ) {
    const inlineChips = selected.slice(0, MAX_INLINE_CHIPS)
    const overflow = Math.max(0, selected.length - MAX_INLINE_CHIPS)
    return (
      <button
        ref={ref}
        type="button"
        data-state={state}
        data-expanded={expanded ? 'true' : undefined}
        aria-expanded={expanded}
        disabled={disabled}
        className={cn(
          'inline-flex flex-wrap items-center gap-1 rounded-full border px-2 py-1 text-xs font-medium transition-colors duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          state === 'empty' &&
            'border-dashed border-border bg-secondary text-muted-foreground hover:text-foreground',
          state === 'filled' && 'border-primary/30 bg-primary/10 text-primary hover:bg-primary/15',
          state === 'invalid' && 'border-destructive/30 bg-destructive/10 text-destructive',
        )}
        {...props}
      >
        <span className="px-1 text-muted-foreground/80">{label}:</span>
        {selected.length === 0 ? (
          <span className="px-1 italic text-muted-foreground/70">
            {required ? 'Required' : 'None'}
          </span>
        ) : (
          inlineChips.map((item) => (
            <span
              key={getId(item)}
              className="inline-flex items-center gap-1 rounded-full bg-card px-2 py-0.5 text-foreground"
            >
              <span className="truncate">{getLabel(item)}</span>
              {/* biome-ignore lint/a11y/useSemanticElements: HTML forbids <button> nested in the trigger <button>. */}
              <span
                role="button"
                aria-label={`Remove ${getLabel(item)}`}
                tabIndex={-1}
                onPointerDown={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  onRemove(item)
                }}
                className="inline-flex size-3.5 cursor-pointer items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="size-2.5" aria-hidden />
              </span>
            </span>
          ))
        )}
        {overflow > 0 ? (
          <span className="rounded-full bg-card px-2 py-0.5 text-muted-foreground">
            +{overflow} more
          </span>
        ) : null}
        <ChevronDown className="size-3 opacity-60" aria-hidden />
      </button>
    )
  },
) as <T>(
  props: MultiPillTriggerProps<T> & { ref?: React.Ref<HTMLButtonElement> },
) => React.ReactElement

export function MultiSearchableCombobox<T>(props: MultiSearchableComboboxProps<T>) {
  const {
    label,
    required = false,
    disabled = false,
    items,
    recents = [],
    value,
    onValueChange,
    getId,
    getLabel,
    getSecondary,
    searchKeywords,
    createAffordance,
    recentSectionLabel = 'Recent',
    allSectionLabel = 'All',
    emptyMessage = 'No matches.',
    placeholder,
    popupWidthClass = 'w-80',
    align = 'start',
  } = props

  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const selectedIds = useMemo(() => new Set(value.map(getId)), [value, getId])
  const filtered = useMemo(
    () => partitionByQuery(query, items, recents, getId, getLabel, searchKeywords),
    [query, items, recents, getId, getLabel, searchKeywords],
  )

  const hasMatches = filtered.recents.length + filtered.others.length > 0
  const trimmedQuery = query.trim()
  const showCreate =
    !!createAffordance &&
    trimmedQuery.length > 0 &&
    !hasMatches &&
    !isExactMatch(trimmedQuery, items, getLabel)

  const toggle = (item: T) => {
    const id = getId(item)
    if (selectedIds.has(id)) {
      onValueChange(value.filter((v) => getId(v) !== id))
    } else {
      onValueChange([...value, item])
    }
    setQuery('')
  }

  const removeOne = (item: T) => {
    const id = getId(item)
    onValueChange(value.filter((v) => getId(v) !== id))
  }

  const handleCreate = () => {
    if (!createAffordance?.enabled) return
    setOpen(false)
    createAffordance.onCreate(trimmedQuery)
  }

  return (
    <Combobox.Root<T, true>
      items={items as T[]}
      multiple
      value={value as T[]}
      onValueChange={(next) => onValueChange((next as T[]) ?? [])}
      inputValue={query}
      onInputValueChange={setQuery}
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setQuery('')
      }}
      autoHighlight
      loopFocus
      filter={null}
    >
      <Combobox.Trigger
        render={
          <MultiPillTrigger<T>
            label={label}
            selected={value}
            getId={getId}
            getLabel={getLabel}
            onRemove={removeOne}
            state={value.length === 0 ? 'empty' : 'filled'}
            required={required}
            disabled={disabled}
            expanded={open}
          />
        }
      />
      <Combobox.Portal>
        <Combobox.Positioner sideOffset={6} align={align} className="isolate z-50">
          <Combobox.Popup
            className={cn(
              'flex flex-col overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-none duration-100 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0',
              popupWidthClass,
            )}
          >
            <div className="border-b border-border p-1">
              <Combobox.Input
                placeholder={placeholder ?? `Search ${label.toLowerCase()}…`}
                className="w-full rounded-sm bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-muted-foreground/60"
              />
            </div>
            <Combobox.List className="flex max-h-72 flex-col overflow-y-auto p-1">
              {filtered.recents.length > 0 ? (
                <ComboboxSection heading={recentSectionLabel}>
                  {filtered.recents.map((item) => (
                    <MultiRow
                      key={getId(item)}
                      item={item}
                      selected={selectedIds.has(getId(item))}
                      label={getLabel(item)}
                      secondary={getSecondary?.(item)}
                      onToggle={toggle}
                    />
                  ))}
                </ComboboxSection>
              ) : null}
              {filtered.others.length > 0 ? (
                <ComboboxSection
                  heading={filtered.recents.length > 0 ? allSectionLabel : undefined}
                >
                  {filtered.others.map((item) => (
                    <MultiRow
                      key={getId(item)}
                      item={item}
                      selected={selectedIds.has(getId(item))}
                      label={getLabel(item)}
                      secondary={getSecondary?.(item)}
                      onToggle={toggle}
                    />
                  ))}
                </ComboboxSection>
              ) : null}
              {!hasMatches && !showCreate ? (
                <p className="px-2 py-3 text-xs text-muted-foreground">{emptyMessage}</p>
              ) : null}
            </Combobox.List>
            {showCreate && createAffordance ? (
              <ComboboxCreateRow
                affordance={createAffordance}
                query={trimmedQuery}
                onActivate={handleCreate}
              />
            ) : null}
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  )
}

interface MultiRowProps<T> {
  item: T
  selected: boolean
  label: string
  secondary?: ReactNode | undefined
  onToggle: (item: T) => void
}

function MultiRow<T>({ item, selected, label, secondary, onToggle }: MultiRowProps<T>) {
  return (
    <Combobox.Item
      value={item}
      onClick={() => onToggle(item)}
      className="group/row flex w-full cursor-pointer items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-sm text-foreground outline-none data-highlighted:bg-accent data-highlighted:text-accent-foreground"
    >
      <span className="flex min-w-0 items-center gap-2">
        <span
          className={cn(
            'inline-flex size-4 items-center justify-center rounded border border-border',
            selected && 'border-primary/40 bg-primary/15 text-primary',
          )}
          aria-hidden
        >
          {selected ? <Check className="size-3" aria-hidden /> : null}
        </span>
        <span className="truncate">{label}</span>
      </span>
      {secondary ? (
        <span className="ml-2 shrink-0 font-mono text-xs text-muted-foreground">{secondary}</span>
      ) : null}
    </Combobox.Item>
  )
}
