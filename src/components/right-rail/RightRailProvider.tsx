import { createContext, type ReactNode, useCallback, useContext, useMemo } from 'react'
import { useLocalStorage } from '@/lib/use-local-storage'
import { type RightRailContent, useRightRailContent } from './useRightRailContent'

interface RightRailContextValue {
  routeId: string | null
  content: RightRailContent | null
  open: boolean
  toggle: () => void
  setOpen: (open: boolean) => void
}

const RightRailContext = createContext<RightRailContextValue | null>(null)

const PARSE_BOOL = (v: unknown) => (typeof v === 'boolean' ? v : null)

export function RightRailProvider({ children }: { children: ReactNode }) {
  const content = useRightRailContent()
  const routeId = content?.routeId ?? null
  const key = routeId ? `boop.right-rail.${routeId}` : 'boop.right-rail.__none'

  const [open, setOpen] = useLocalStorage<boolean>(key, true, { parse: PARSE_BOOL })

  const toggle = useCallback(() => setOpen((prev) => !prev), [setOpen])

  const value = useMemo<RightRailContextValue>(
    () => ({ routeId, content, open: routeId ? open : false, toggle, setOpen }),
    [routeId, content, open, toggle, setOpen],
  )

  return <RightRailContext.Provider value={value}>{children}</RightRailContext.Provider>
}

export function useRightRail(): RightRailContextValue {
  const ctx = useContext(RightRailContext)
  if (!ctx) throw new Error('useRightRail must be used inside <RightRailProvider>')
  return ctx
}
