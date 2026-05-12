import { useRef } from 'react'

interface SlugAutoFillController {
  isManual: () => boolean
  markManual: () => void
  reset: () => void
}

export function useSlugAutoFill(initiallyManual: boolean): SlugAutoFillController {
  const manual = useRef(initiallyManual)
  return {
    isManual: () => manual.current,
    markManual: () => {
      manual.current = true
    },
    reset: () => {
      manual.current = false
    },
  }
}
