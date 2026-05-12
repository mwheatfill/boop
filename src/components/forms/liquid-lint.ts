import type { Diagnostic } from '@codemirror/lint'
import type { EditorView } from '@codemirror/view'
import { Liquid } from 'liquidjs'

const lintEngine = new Liquid({ strictFilters: false, strictVariables: false })

interface LiquidErrorLike {
  message: string
  name?: string
  token?: { begin?: number; end?: number }
}

function isLiquidErrorLike(value: unknown): value is LiquidErrorLike {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { message?: unknown }).message === 'string'
  )
}

function firstLine(message: string): string {
  const idx = message.indexOf('\n')
  return idx === -1 ? message : message.slice(0, idx)
}

function trimLocationSuffix(message: string): string {
  return message.replace(/,\s*line:\d+,\s*col:\d+$/, '')
}

export function lintLiquidSource(source: string): Diagnostic[] {
  if (source.length === 0) return []
  try {
    lintEngine.parse(source)
    return []
  } catch (err) {
    if (!isLiquidErrorLike(err)) return []
    const begin = err.token?.begin ?? 0
    const end = err.token?.end ?? Math.min(begin + 1, source.length)
    const from = Math.min(Math.max(begin, 0), source.length)
    const to = Math.min(Math.max(end, from + 1), source.length)
    return [
      {
        from,
        to,
        severity: 'error',
        message: trimLocationSuffix(firstLine(err.message)),
        source: err.name ?? 'Liquid',
      },
    ]
  }
}

export function liquidLintSource(view: EditorView): Diagnostic[] {
  return lintLiquidSource(view.state.doc.toString())
}
