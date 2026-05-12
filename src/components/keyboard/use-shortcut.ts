import { type RefObject, useEffect, useId, useRef } from 'react'
import { type ShortcutSection, useKeyboard } from './KeyboardProvider'

interface UseShortcutOptions {
  description: string
  section: ShortcutSection
  disabled?: boolean
  /** Set true to receive a ref that <ShortcutHint> can attach a hover-tooltip to. */
  withTarget?: boolean
}

export function useShortcut(
  key: string,
  handler: (e: KeyboardEvent) => void,
  options: UseShortcutOptions,
): RefObject<HTMLElement | null> {
  const id = useId()
  const targetRef = useRef<HTMLElement | null>(null)
  const { register, unregister } = useKeyboard()
  const handlerRef = useRef(handler)
  handlerRef.current = handler

  useEffect(() => {
    if (options.disabled) {
      unregister(id)
      return
    }
    register(id, {
      key,
      description: options.description,
      section: options.section,
      handler: (e) => handlerRef.current(e),
      ...(options.disabled ? { disabled: true } : {}),
      ...(options.withTarget ? { target: targetRef } : {}),
    })
    return () => unregister(id)
  }, [
    id,
    key,
    options.description,
    options.section,
    options.disabled,
    options.withTarget,
    register,
    unregister,
  ])

  return targetRef
}
