import { type RenderContext, renderTemplate } from './render'

export interface PreviewBodyResult {
  rendered: string
  error?: string
}

export interface PreviewHeadersResult {
  rendered: string
  headers?: Record<string, string>
  error?: string
}

export async function previewBody(
  template: string,
  context: RenderContext,
): Promise<PreviewBodyResult> {
  try {
    const rendered = await renderTemplate(template, context)
    return { rendered }
  } catch (err) {
    return { rendered: '', error: err instanceof Error ? err.message : String(err) }
  }
}

function validateHeaders(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Headers must be a JSON object')
  }
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof v !== 'string') {
      throw new Error(`Header value for "${k}" must be a string`)
    }
    out[k] = v
  }
  return out
}

export async function previewHeaders(
  template: string,
  context: RenderContext,
): Promise<PreviewHeadersResult> {
  let rendered: string
  try {
    rendered = await renderTemplate(template, context)
  } catch (err) {
    return { rendered: '', error: err instanceof Error ? err.message : String(err) }
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(rendered)
  } catch (err) {
    return {
      rendered,
      error: `Headers must be valid JSON: ${err instanceof Error ? err.message : String(err)}`,
    }
  }
  try {
    const headers = validateHeaders(parsed)
    return { rendered, headers }
  } catch (err) {
    return { rendered, error: err instanceof Error ? err.message : String(err) }
  }
}

export const SYNTHETIC_RENDER_CONTEXT_DEFAULTS = {
  runId: 'run_preview',
  attemptNumber: 1,
} as const

export function syntheticRenderContext({
  customerName,
  customerTimezone,
  now = new Date(),
}: {
  customerName: string
  customerTimezone: string
  now?: Date
}): RenderContext {
  return {
    ...SYNTHETIC_RENDER_CONTEXT_DEFAULTS,
    customerName,
    customerTimezone,
    now,
  }
}
