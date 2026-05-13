'use client'
import { Plus } from 'lucide-react'
import type { ReactNode } from 'react'
import { fuzzyScore } from '@/lib/keyboard/fuzzy'

export interface CreateAffordance {
  enabled: boolean
  disabledReason?: string
  onCreate: (query: string) => void
  label?: (query: string) => string
}

export interface SectionedItems<T> {
  recents: T[]
  others: T[]
}

export function partitionByQuery<T>(
  query: string,
  items: readonly T[],
  recents: readonly T[],
  getId: (item: T) => string,
  getLabel: (item: T) => string,
  searchKeywords: ((item: T) => string[]) | undefined,
): SectionedItems<T> {
  const itemIds = new Set(items.map(getId))
  const validRecents = recents.filter((r) => itemIds.has(getId(r)))
  const recentIds = new Set(validRecents.map(getId))
  const trimmed = query.trim()

  if (!trimmed) {
    return {
      recents: validRecents,
      others: items.filter((item) => !recentIds.has(getId(item))),
    }
  }

  const scored = items.flatMap((item) => {
    const score = fuzzyScore(getLabel(item), trimmed, searchKeywords?.(item) ?? [])
    return score > 0 ? [{ item, score }] : []
  })
  scored.sort((a, b) => b.score - a.score)
  const matches = scored.map((entry) => entry.item)

  return {
    recents: matches.filter((item) => recentIds.has(getId(item))),
    others: matches.filter((item) => !recentIds.has(getId(item))),
  }
}

export function isExactMatch<T>(
  query: string,
  items: readonly T[],
  getLabel: (item: T) => string,
): boolean {
  const trimmed = query.trim().toLowerCase()
  if (!trimmed) return false
  return items.some((item) => getLabel(item).toLowerCase() === trimmed)
}

export function ComboboxSection({
  heading,
  children,
}: {
  heading?: string | undefined
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-px py-1 first:pt-0 last:pb-0">
      {heading ? (
        <div className="px-2 pb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground/70">
          {heading}
        </div>
      ) : null}
      {children}
    </div>
  )
}

interface CreateRowProps {
  affordance: CreateAffordance
  query: string
  onActivate: () => void
}

export function ComboboxCreateRow({ affordance, query, onActivate }: CreateRowProps) {
  const text = affordance.label?.(query) ?? `Create "${query}"`
  if (!affordance.enabled) {
    return (
      <div
        className="flex w-full items-center gap-2 border-t border-border px-3 py-2 text-left text-sm text-muted-foreground"
        title={affordance.disabledReason ?? 'Not allowed'}
        aria-disabled="true"
      >
        <Plus className="size-3.5" aria-hidden />
        <span className="truncate">{text}</span>
        {affordance.disabledReason ? (
          <span className="ml-auto shrink-0 text-xs italic">{affordance.disabledReason}</span>
        ) : null}
      </div>
    )
  }
  return (
    <button
      type="button"
      onClick={onActivate}
      className="flex w-full items-center gap-2 border-t border-border bg-accent/40 px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-accent/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Plus className="size-3.5 text-primary" aria-hidden />
      <span className="truncate">{text}</span>
    </button>
  )
}
