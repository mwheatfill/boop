import { useCallback, useEffect, useRef, useState } from 'react'

const SAME_TAB_EVENT = 'boop:local-storage-changed'

interface SameTabDetail {
  key: string
  raw: string | null
}

function emitSameTab(key: string, raw: string | null): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent<SameTabDetail>(SAME_TAB_EVENT, { detail: { key, raw } }))
}

export function writeLocalStorage(key: string, value: unknown): void {
  if (typeof localStorage === 'undefined') return
  try {
    const raw = JSON.stringify(value)
    localStorage.setItem(key, raw)
    emitSameTab(key, raw)
  } catch {
    // Quota or disabled storage; degrade silently.
  }
}

export function useLocalStorage<T>(
  key: string,
  initialValue: T,
  options?: { parse?: (raw: unknown) => T | null },
): [T, (value: T | ((prev: T) => T)) => void] {
  const parseRef = useRef(options?.parse)
  parseRef.current = options?.parse
  const initialRef = useRef(initialValue)
  initialRef.current = initialValue

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

  const [value, setValue] = useState<T>(() => read())
  const lastRawRef = useRef<string | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const refresh = () => {
      const raw = localStorage.getItem(key)
      if (raw === lastRawRef.current) return
      lastRawRef.current = raw
      setValue(read())
    }
    refresh()
    const onSameTab = (e: Event) => {
      const detail = (e as CustomEvent<SameTabDetail>).detail
      if (detail?.key === key) refresh()
    }
    const onStorage = (e: StorageEvent) => {
      if (e.key === key) refresh()
    }
    window.addEventListener(SAME_TAB_EVENT, onSameTab)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener(SAME_TAB_EVENT, onSameTab)
      window.removeEventListener('storage', onStorage)
    }
  }, [key, read])

  const set = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const resolved = typeof next === 'function' ? (next as (p: T) => T)(prev) : next
        try {
          const raw = JSON.stringify(resolved)
          localStorage.setItem(key, raw)
          lastRawRef.current = raw
          emitSameTab(key, raw)
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
