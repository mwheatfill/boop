import { useLocalStorage } from '@/lib/use-local-storage'
import { parseRecents, RECENTS_STORAGE_KEY, type RecentEntry } from './store'

const EMPTY: RecentEntry[] = []

export function useRecents(): RecentEntry[] {
  const [recents] = useLocalStorage<RecentEntry[]>(RECENTS_STORAGE_KEY, EMPTY, {
    parse: parseRecents,
  })
  return recents
}
