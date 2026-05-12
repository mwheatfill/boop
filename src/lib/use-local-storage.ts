import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Minimal localStorage-backed state hook.
 *
 * - SSR-safe: returns `initialValue` until mount.
 * - Cross-tab: subscribes to the storage event so a change in one tab
 *   reflects in another.
 * - Validate untrusted reads via the optional `parse` arg; bad JSON
 *   falls back to `initialValue` rather than throwing.
 *
 * `parse` is consumed via a ref so callers can pass an inline `{ parse }`
 * options object without re-triggering the mount/sync effects every render.
 */
export function useLocalStorage<T>(
  key: string,
  initialValue: T,
  options?: { parse?: (raw: unknown) => T | null },
): [T, (value: T | ((prev: T) => T)) => void] {
  // Capture parse + initialValue via refs so callers can pass inline
  // options/defaults without re-triggering the effects below each render.
  const parseRef = useRef(options?.parse)
  parseRef.current = options?.parse
  const initialRef = useRef(initialValue)

  const read = useCallback((): T => {
    if (typeof localStorage === 'undefined') return initialRef.current
    try {
      const raw = localStorage.getItem(key)
      if (raw == null) return initialRef.current
      const decoded = JSON.parse(raw) as unknown
      const parse = parseRef.current
      if (parse) {
        const validated = parse(decoded)
        return validated ?? initialRef.current
      }
      return decoded as T
    } catch {
      return initialRef.current
    }
  }, [key])

  const [value, setValue] = useState<T>(initialValue)

  // Hydrate on mount.
  useEffect(() => {
    setValue(read())
  }, [read])

  // Cross-tab sync.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const onStorage = (e: StorageEvent) => {
      if (e.key !== key) return
      setValue(read())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [key, read])

  const set = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const resolved = typeof next === 'function' ? (next as (p: T) => T)(prev) : next
        try {
          localStorage.setItem(key, JSON.stringify(resolved))
        } catch {
          // Quota or disabled storage; keep in-memory.
        }
        return resolved
      })
    },
    [key],
  )

  return [value, set]
}
