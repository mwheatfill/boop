import {
  createContext,
  type ReactNode,
  type RefObject,
  use,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react'
import { tinykeys } from 'tinykeys'

export type ShortcutSection = 'page' | 'navigation' | 'global' | 'actions'

export interface ShortcutEntry {
  key: string
  description: string
  section: ShortcutSection
  handler: (e: KeyboardEvent) => void
  disabled?: boolean
  target?: RefObject<HTMLElement | null>
}

interface KeyboardContextValue {
  register: (id: string, entry: ShortcutEntry) => void
  unregister: (id: string) => void
  registry: ReadonlyMap<string, ShortcutEntry>
  chordPrefix: string | null
  paletteOpen: boolean
  setPaletteOpen: (open: boolean) => void
  cheatsheetOpen: boolean
  setCheatsheetOpen: (open: boolean) => void
}

const KeyboardContext = createContext<KeyboardContextValue | null>(null)

export function useKeyboard(): KeyboardContextValue {
  const ctx = use(KeyboardContext)
  if (!ctx) throw new Error('useKeyboard must be used inside <KeyboardProvider>')
  return ctx
}

const CHORD_PREFIXES = new Set(['g', 'n'])
const CHORD_TIMEOUT_MS = 1200
const INPUT_SELECTOR = 'input, textarea, [contenteditable="true"]'
const INPUT_EXEMPT_KEYS = new Set(['$mod+k'])

interface KeyboardUiState {
  chordPrefix: string | null
  paletteOpen: boolean
  cheatsheetOpen: boolean
}

type KeyboardUiAction =
  | { type: 'chord-started'; prefix: string }
  | { type: 'chord-cleared' }
  | { type: 'palette-open-changed'; open: boolean }
  | { type: 'cheatsheet-open-changed'; open: boolean }

const initialKeyboardUiState: KeyboardUiState = {
  chordPrefix: null,
  paletteOpen: false,
  cheatsheetOpen: false,
}

function keyboardUiReducer(state: KeyboardUiState, action: KeyboardUiAction): KeyboardUiState {
  switch (action.type) {
    case 'chord-started':
      return { ...state, chordPrefix: action.prefix }
    case 'chord-cleared':
      return { ...state, chordPrefix: null }
    case 'palette-open-changed':
      return { ...state, paletteOpen: action.open }
    case 'cheatsheet-open-changed':
      return { ...state, cheatsheetOpen: action.open }
  }
}

function isTypingTarget(target: EventTarget | null): boolean {
  return target instanceof Element && target.matches(INPUT_SELECTOR)
}

export function KeyboardProvider({ children }: { children: ReactNode }) {
  const [registry, setRegistry] = useState<Map<string, ShortcutEntry>>(() => new Map())
  const [uiState, dispatchUi] = useReducer(keyboardUiReducer, initialKeyboardUiState)
  const { chordPrefix, paletteOpen, cheatsheetOpen } = uiState
  const setPaletteOpen = useCallback(
    (open: boolean) => dispatchUi({ type: 'palette-open-changed', open }),
    [],
  )
  const setCheatsheetOpen = useCallback(
    (open: boolean) => dispatchUi({ type: 'cheatsheet-open-changed', open }),
    [],
  )

  const register = useCallback((id: string, entry: ShortcutEntry) => {
    setRegistry((prev) => {
      const next = new Map(prev)
      next.set(id, entry)
      return next
    })
  }, [])

  const unregister = useCallback((id: string) => {
    setRegistry((prev) => {
      if (!prev.has(id)) return prev
      const next = new Map(prev)
      next.delete(id)
      return next
    })
  }, [])

  useEffect(() => {
    const handlers: Record<string, (e: KeyboardEvent) => void> = {}
    // Insertion order means most-recently-registered wins on duplicate keys.
    for (const entry of registry.values()) {
      if (entry.disabled) continue
      handlers[entry.key] = (e: KeyboardEvent) => {
        if (isTypingTarget(e.target) && !INPUT_EXEMPT_KEYS.has(entry.key)) return
        entry.handler(e)
      }
    }
    return tinykeys(window, handlers, { timeout: CHORD_TIMEOUT_MS })
  }, [registry])

  const registryRef = useRef(registry)
  registryRef.current = registry
  const chordPrefixRef = useRef<string | null>(null)
  chordPrefixRef.current = chordPrefix

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null
    const clearChord = () => {
      if (timer) {
        clearTimeout(timer)
        timer = null
      }
      dispatchUi({ type: 'chord-cleared' })
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (isTypingTarget(e.target)) return
      if (CHORD_PREFIXES.has(e.key)) {
        const hasMatch = Array.from(registryRef.current.values()).some(
          (entry) => !entry.disabled && entry.key.startsWith(`${e.key} `),
        )
        if (!hasMatch) return
        dispatchUi({ type: 'chord-started', prefix: e.key })
        if (timer) clearTimeout(timer)
        timer = setTimeout(clearChord, CHORD_TIMEOUT_MS)
        return
      }
      if (chordPrefixRef.current) clearChord()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      if (timer) clearTimeout(timer)
    }
  }, [])

  const value = useMemo<KeyboardContextValue>(
    () => ({
      register,
      unregister,
      registry,
      chordPrefix,
      paletteOpen,
      setPaletteOpen,
      cheatsheetOpen,
      setCheatsheetOpen,
    }),
    [
      register,
      unregister,
      registry,
      chordPrefix,
      paletteOpen,
      setPaletteOpen,
      cheatsheetOpen,
      setCheatsheetOpen,
    ],
  )

  return <KeyboardContext value={value}>{children}</KeyboardContext>
}
