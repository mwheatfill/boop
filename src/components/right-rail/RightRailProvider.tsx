import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { useRightRailContent } from './useRightRailContent'

interface RightRailContextValue {
  /** Active route's id, or null when the rail isn't available on this surface. */
  routeId: string | null
  open: boolean
  toggle: () => void
  setOpen: (open: boolean) => void
}

const RightRailContext = createContext<RightRailContextValue | null>(null)

function storageKey(routeId: string): string {
  return `boop.right-rail.${routeId}`
}

function readOpen(routeId: string, defaultOpen: boolean): boolean {
  if (typeof localStorage === 'undefined') return defaultOpen
  try {
    const raw = localStorage.getItem(storageKey(routeId))
    if (raw === 'true') return true
    if (raw === 'false') return false
    return defaultOpen
  } catch {
    return defaultOpen
  }
}

function writeOpen(routeId: string, open: boolean): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(storageKey(routeId), String(open))
  } catch {
    // Quota; degrade silently.
  }
}

export function RightRailProvider({ children }: { children: ReactNode }) {
  const content = useRightRailContent()
  const routeId = content?.routeId ?? null

  // Detail routes default to open; list routes never reach here (content is null).
  const [open, setOpenState] = useState(false)

  useEffect(() => {
    if (!routeId) {
      setOpenState(false)
      return
    }
    setOpenState(readOpen(routeId, true))
  }, [routeId])

  const setOpen = useCallback(
    (next: boolean) => {
      setOpenState(next)
      if (routeId) writeOpen(routeId, next)
    },
    [routeId],
  )

  const toggle = useCallback(() => {
    setOpenState((prev) => {
      const next = !prev
      if (routeId) writeOpen(routeId, next)
      return next
    })
  }, [routeId])

  const value = useMemo<RightRailContextValue>(
    () => ({ routeId, open, toggle, setOpen }),
    [routeId, open, toggle, setOpen],
  )

  return <RightRailContext.Provider value={value}>{children}</RightRailContext.Provider>
}

export function useRightRail(): RightRailContextValue {
  const ctx = useContext(RightRailContext)
  if (!ctx) throw new Error('useRightRail must be used inside <RightRailProvider>')
  return ctx
}
