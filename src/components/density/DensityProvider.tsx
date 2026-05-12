import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo } from 'react'
import { useLocalStorage } from '@/lib/use-local-storage'

export type Density = 'compact' | 'spacious'

const STORAGE_KEY = 'boop.density'
const VALID: Density[] = ['compact', 'spacious']

interface DensityContextValue {
  density: Density
  setDensity: (d: Density) => void
}

const DensityContext = createContext<DensityContextValue | null>(null)

function parseDensity(raw: unknown): Density | null {
  return typeof raw === 'string' && (VALID as string[]).includes(raw) ? (raw as Density) : null
}

export function DensityProvider({ children }: { children: ReactNode }) {
  const [density, setDensityState] = useLocalStorage<Density>(STORAGE_KEY, 'compact', {
    parse: parseDensity,
  })

  // Reflect to <html data-density="…"> so the CSS variables in app.css apply.
  useEffect(() => {
    if (typeof document === 'undefined') return
    document.documentElement.dataset.density = density
  }, [density])

  const setDensity = useCallback(
    (next: Density) => {
      setDensityState(next)
    },
    [setDensityState],
  )

  const value = useMemo(() => ({ density, setDensity }), [density, setDensity])

  return <DensityContext.Provider value={value}>{children}</DensityContext.Provider>
}

export function useDensity(): DensityContextValue {
  const ctx = useContext(DensityContext)
  if (!ctx) throw new Error('useDensity must be used inside <DensityProvider>')
  return ctx
}
