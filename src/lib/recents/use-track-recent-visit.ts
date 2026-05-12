import { useEffect } from 'react'
import { type RecentEntry, visitRecent } from './store'

/** Record a Customer or Job visit in the LRU recents list when the page mounts. */
export function useTrackRecentVisit(entry: Omit<RecentEntry, 'visitedAt'>): void {
  const { id, entity, label, slug, customerSlug } = entry
  useEffect(() => {
    const base = { id, entity, label, slug }
    visitRecent(customerSlug ? { ...base, customerSlug } : base)
  }, [id, entity, label, slug, customerSlug])
}
