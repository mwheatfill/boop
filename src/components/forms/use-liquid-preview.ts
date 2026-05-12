import { useEffect, useState } from 'react'
import type { RenderContext } from '@/lib/dispatch/render'
import { previewBody, previewHeaders } from '@/lib/dispatch/render-preview'

export type LiquidPreviewVariant = 'body' | 'headers'

export interface UseLiquidPreviewInput {
  template: string
  context: RenderContext
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
  context,
  variant,
  debounceMs = DEFAULT_DEBOUNCE_MS,
}: UseLiquidPreviewInput): UseLiquidPreviewResult {
  const [state, setState] = useState<UseLiquidPreviewResult>({ rendered: '' })

  useEffect(() => {
    let canceled = false
    const timer = setTimeout(async () => {
      const result =
        variant === 'headers'
          ? await previewHeaders(template, context)
          : await previewBody(template, context)
      if (canceled) return
      setState({
        rendered: result.rendered,
        ...(result.error ? { error: result.error } : {}),
      })
    }, debounceMs)
    return () => {
      canceled = true
      clearTimeout(timer)
    }
  }, [template, variant, context, debounceMs])

  return state
}
