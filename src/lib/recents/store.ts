const STORAGE_KEY = 'boop.recents'
const MAX = 5

export interface RecentEntry {
  id: string
  entity: 'customer' | 'job'
  label: string
  slug: string
  /** For Jobs: { customerSlug, jobSlug }. For Customers: just { customerSlug }. */
  customerSlug?: string
  visitedAt: number
}

function readStorage(): RecentEntry[] {
  if (typeof localStorage === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (r): r is RecentEntry =>
        r &&
        typeof r === 'object' &&
        typeof r.id === 'string' &&
        (r.entity === 'customer' || r.entity === 'job') &&
        typeof r.label === 'string' &&
        typeof r.slug === 'string' &&
        typeof r.visitedAt === 'number',
    )
  } catch {
    return []
  }
}

function writeStorage(entries: RecentEntry[]): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX)))
  } catch {
    // Quota or disabled storage; degrade silently.
  }
}

export function readRecents(): RecentEntry[] {
  return readStorage().slice(0, MAX)
}

export function visitRecent(entry: Omit<RecentEntry, 'visitedAt'>): void {
  const now = Date.now()
  const prior = readStorage().filter((r) => r.id !== entry.id)
  writeStorage([{ ...entry, visitedAt: now }, ...prior])
}

export function clearRecents(): void {
  writeStorage([])
}
