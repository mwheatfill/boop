import { useEffect, useState } from 'react'
import { previewBody, previewHeaders, syntheticRenderContext } from '@/lib/dispatch/render-preview'

export type LiquidPreviewVariant = 'body' | 'headers'

export interface UseLiquidPreviewInput {
  template: string
  customerName: string
  customerTimezone: string
  variant: LiquidPreviewVariant
  debounceMs?: number
}

export interface UseLiquidPreviewResult {
  rendered: string
  error?: string
}

const DEFAULT_DEBOUNCE_MS = 150

export function useLiquidPreview({
  template,
  customerName,
  customerTimezone,
  variant,
  debounceMs = DEFAULT_DEBOUNCE_MS,
}: UseLiquidPreviewInput): UseLiquidPreviewResult {
  const [state, setState] = useState<UseLiquidPreviewResult>({ rendered: '' })

  useEffect(() => {
    let canceled = false
    const timer = setTimeout(async () => {
      const context = syntheticRenderContext({ customerName, customerTimezone })
      const result =
        variant === 'headers'
          ? await previewHeaders(template, context)
          : await previewBody(template, context)
      if (canceled) return
      setState((prev) =>
        prev.rendered === result.rendered && prev.error === result.error
          ? prev
          : { rendered: result.rendered, ...(result.error ? { error: result.error } : {}) },
      )
    }, debounceMs)
    return () => {
      canceled = true
      clearTimeout(timer)
    }
  }, [template, customerName, customerTimezone, variant, debounceMs])

  return state
}
