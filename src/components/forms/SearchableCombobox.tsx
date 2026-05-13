'use client'
import { Combobox } from '@base-ui/react/combobox'
import { Check } from 'lucide-react'
import { type ReactNode, useMemo, useState } from 'react'
import {
  ComboboxCreateRow,
  ComboboxSection,
  type CreateAffordance,
  isExactMatch,
  partitionByQuery,
} from '@/components/forms/combobox-internals'
import { PillButton } from '@/components/forms/PillPicker'
import { cn } from '@/lib/utils'

export type { CreateAffordance }

export interface SearchableComboboxProps<T> {
  label: string
  required?: boolean
  disabled?: boolean
  items: readonly T[]
  recents?: readonly T[]
  value: T | null
  onValueChange: (value: T | null) => void
  getId: (item: T) => string
  getLabel: (item: T) => string
  getSecondary?: ((item: T) => ReactNode) | undefined
  renderRow?: ((item: T) => ReactNode) | undefined
  searchKeywords?: ((item: T) => string[]) | undefined
  createAffordance?: CreateAffordance | undefined
  onOpenChange?: ((open: boolean) => void) | undefined
  recentSectionLabel?: string
  allSectionLabel?: string
  emptyMessage?: string
  placeholder?: string
  popupWidthClass?: string
  align?: 'start' | 'center' | 'end'
}

export function SearchableCombobox<T>(props: SearchableComboboxProps<T>) {
  const {
    label,
    required,
    disabled,
    items,
    recents = [],
    value,
    onValueChange,
    getId,
    getLabel,
    getSecondary,
    renderRow,
    searchKeywords,
    createAffordance,
    onOpenChange,
    recentSectionLabel = 'Recent',
    allSectionLabel = 'All',
    emptyMessage = 'No matches.',
    placeholder,
    popupWidthClass = 'w-72',
    align = 'start',
  } = props

  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

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
  const valueId = value ? getId(value) : null

  const handleSelect = (item: T) => {
    onValueChange(item)
    setOpen(false)
  }

  const handleCreate = () => {
    if (!createAffordance?.enabled) return
    setOpen(false)
    createAffordance.onCreate(trimmedQuery)
  }

  return (
    <Combobox.Root<T>
      items={items as T[]}
      value={value}
      onValueChange={(next) => onValueChange((next as T | null) ?? null)}
      inputValue={query}
      onInputValueChange={setQuery}
      itemToStringLabel={(item) => getLabel(item)}
      itemToStringValue={(item) => getId(item)}
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setQuery('')
        onOpenChange?.(next)
      }}
      autoHighlight
      loopFocus
      filter={null}
    >
      <Combobox.Trigger
        render={
          <PillButton
            label={label}
            value={value ? getLabel(value) : undefined}
            state={value ? 'filled' : 'empty'}
            {...(required ? { required: true } : {})}
            {...(disabled ? { disabled: true } : {})}
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
                    <ComboboxRow
                      key={getId(item)}
                      item={item}
                      selected={getId(item) === valueId}
                      label={getLabel(item)}
                      secondary={getSecondary?.(item)}
                      onSelect={handleSelect}
                      renderRow={renderRow}
                    />
                  ))}
                </ComboboxSection>
              ) : null}
              {filtered.others.length > 0 ? (
                <ComboboxSection
                  heading={filtered.recents.length > 0 ? allSectionLabel : undefined}
                >
                  {filtered.others.map((item) => (
                    <ComboboxRow
                      key={getId(item)}
                      item={item}
                      selected={getId(item) === valueId}
                      label={getLabel(item)}
                      secondary={getSecondary?.(item)}
                      onSelect={handleSelect}
                      renderRow={renderRow}
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

interface ComboboxRowProps<T> {
  item: T
  selected: boolean
  label: string
  secondary?: ReactNode | undefined
  onSelect: (item: T) => void
  renderRow?: ((item: T) => ReactNode) | undefined
}

function ComboboxRow<T>({
  item,
  selected,
  label,
  secondary,
  onSelect,
  renderRow,
}: ComboboxRowProps<T>) {
  return (
    <Combobox.Item
      value={item}
      onClick={() => onSelect(item)}
      className="group/row flex w-full cursor-pointer items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-sm text-foreground outline-none data-highlighted:bg-accent data-highlighted:text-accent-foreground"
    >
      {renderRow ? (
        renderRow(item)
      ) : (
        <>
          <span className="flex min-w-0 items-center gap-2">
            {selected ? (
              <Check className="size-3 text-primary" aria-hidden />
            ) : (
              <span className="inline-block size-3" aria-hidden />
            )}
            <span className="truncate">{label}</span>
          </span>
          {secondary ? (
            <span className="ml-2 shrink-0 font-mono text-xs text-muted-foreground">
              {secondary}
            </span>
          ) : null}
        </>
      )}
    </Combobox.Item>
  )
}
