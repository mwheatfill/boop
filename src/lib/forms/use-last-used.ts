import { useCallback } from 'react'
import { useLocalStorage } from '@/lib/use-local-storage'

export interface UseLastUsedResult<T> {
  lastUsed: T | null
  recordUse: (item: T) => void
  clear: () => void
}

const PARSE_STRING = (raw: unknown): string | null => (typeof raw === 'string' ? raw : null)

export function useLastUsed<T>(
  key: string,
  items: readonly T[],
  getId: (item: T) => string,
): UseLastUsedResult<T> {
  const [storedId, setStoredId] = useLocalStorage<string | null>(key, null, { parse: PARSE_STRING })
  const lastUsed = storedId ? (items.find((item) => getId(item) === storedId) ?? null) : null
  const recordUse = useCallback((item: T) => setStoredId(getId(item)), [getId, setStoredId])
  const clear = useCallback(() => setStoredId(null), [setStoredId])
  return { lastUsed, recordUse, clear }
}
