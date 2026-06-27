import { useEffect } from 'react'
import { type RecentEntry, visitRecent } from './store'

/** Record a Workspace or Job visit in the LRU recents list when the page mounts. */
export function useTrackRecentVisit(entry: Omit<RecentEntry, 'visitedAt'>): void {
  const { id, entity, label, slug, workspaceSlug } = entry
  useEffect(() => {
    const base = { id, entity, label, slug }
    visitRecent(workspaceSlug ? { ...base, workspaceSlug } : base)
  }, [id, entity, label, slug, workspaceSlug])
}
