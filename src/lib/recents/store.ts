import { writeLocalStorage } from '@/lib/use-local-storage'

export const RECENTS_STORAGE_KEY = 'boop.recents'
export const RECENTS_LIMIT = 5

export interface RecentEntry {
  id: string
  entity: 'customer' | 'job'
  label: string
  slug: string
  customerSlug?: string
  visitedAt: number
}

export function parseRecents(raw: unknown): RecentEntry[] | null {
  if (!Array.isArray(raw)) return null
  return raw
    .filter(
      (r): r is RecentEntry =>
        r &&
        typeof r === 'object' &&
        typeof r.id === 'string' &&
        (r.entity === 'customer' || r.entity === 'job') &&
        typeof r.label === 'string' &&
        typeof r.slug === 'string' &&
        typeof r.visitedAt === 'number',
    )
    .slice(0, RECENTS_LIMIT)
}

function readStorage(): RecentEntry[] {
  if (typeof localStorage === 'undefined') return []
  try {
    const raw = localStorage.getItem(RECENTS_STORAGE_KEY)
    if (!raw) return []
    return parseRecents(JSON.parse(raw)) ?? []
  } catch {
    return []
  }
}

export function readRecents(): RecentEntry[] {
  return readStorage()
}

export function visitRecent(entry: Omit<RecentEntry, 'visitedAt'>): void {
  const prior = readStorage().filter((r) => r.id !== entry.id)
  writeLocalStorage(
    RECENTS_STORAGE_KEY,
    [{ ...entry, visitedAt: Date.now() }, ...prior].slice(0, RECENTS_LIMIT),
  )
}

export function clearRecents(): void {
  writeLocalStorage(RECENTS_STORAGE_KEY, [])
}
