import { useEffect, useState } from 'react'
import { RECENTS_EVENT, RECENTS_STORAGE_KEY, type RecentEntry, readRecents } from './store'

/**
 * Reactive read of the shared recents store.
 *
 * Subscribes to both the cross-tab `storage` event and the same-tab
 * `boop:recents-changed` custom event so the sidebar Recent group and the
 * Cmd+K palette stay in sync with the live visit log.
 */
export function useRecents(): RecentEntry[] {
  const [recents, setRecents] = useState<RecentEntry[]>([])

  useEffect(() => {
    setRecents(readRecents())
    if (typeof window === 'undefined') return
    const refresh = () => setRecents(readRecents())
    const onStorage = (e: StorageEvent) => {
      if (e.key === RECENTS_STORAGE_KEY) refresh()
    }
    window.addEventListener(RECENTS_EVENT, refresh)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener(RECENTS_EVENT, refresh)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  return recents
}
