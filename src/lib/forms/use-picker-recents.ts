import { useCallback, useMemo } from 'react'
import { useLocalStorage } from '@/lib/use-local-storage'

const DEFAULT_LIMIT = 5

const PARSE_STRING_ARRAY = (raw: unknown): string[] | null =>
  Array.isArray(raw) && raw.every((v) => typeof v === 'string') ? (raw as string[]) : null

export interface UsePickerRecentsResult<T> {
  recents: T[]
  recordUse: (item: T) => void
  clear: () => void
}

export function usePickerRecents<T>(
  key: string,
  items: readonly T[],
  getId: (item: T) => string,
  limit: number = DEFAULT_LIMIT,
): UsePickerRecentsResult<T> {
  const [ids, setIds] = useLocalStorage<string[]>(key, [], { parse: PARSE_STRING_ARRAY })

  const recents = useMemo(() => {
    const byId = new Map(items.map((item) => [getId(item), item]))
    return ids.flatMap((id) => {
      const item = byId.get(id)
      return item ? [item] : []
    })
  }, [ids, items, getId])

  const recordUse = useCallback(
    (item: T) => {
      const id = getId(item)
      setIds((prev) => {
        if (prev[0] === id) return prev
        return [id, ...prev.filter((existing) => existing !== id)].slice(0, limit)
      })
    },
    [getId, limit, setIds],
  )

  const clear = useCallback(() => setIds([]), [setIds])

  return { recents, recordUse, clear }
}
