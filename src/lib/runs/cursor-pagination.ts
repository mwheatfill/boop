import { and, eq, lt, or, type SQL } from 'drizzle-orm'
import { runs } from '@/lib/db/schema'

export interface RunCursor {
  startedAt: Date
  id: string
}

function toBase64Url(input: string): string {
  return btoa(input).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(input: string): string {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/')
  return atob(padded)
}

export function encodeCursor(cursor: RunCursor): string {
  return toBase64Url(`${cursor.startedAt.toISOString()}|${cursor.id}`)
}

export function parseCursor(input: string | undefined): RunCursor | null {
  if (!input) return null
  let decoded: string
  try {
    decoded = fromBase64Url(input)
  } catch {
    return null
  }
  const pipe = decoded.indexOf('|')
  if (pipe === -1) return null
  const iso = decoded.slice(0, pipe)
  const id = decoded.slice(pipe + 1)
  if (!iso || !id) return null
  const startedAt = new Date(iso)
  if (Number.isNaN(startedAt.getTime())) return null
  return { startedAt, id }
}

export function cursorCondition(cursor: RunCursor | null): SQL | undefined {
  if (!cursor) return undefined
  return or(
    lt(runs.startedAt, cursor.startedAt),
    and(eq(runs.startedAt, cursor.startedAt), lt(runs.id, cursor.id)),
  )
}

export function buildWhere(
  cursor: RunCursor | null,
  ...conditions: (SQL | undefined)[]
): SQL | undefined {
  const all = [cursorCondition(cursor), ...conditions].filter((c): c is SQL => c !== undefined)
  if (all.length === 0) return undefined
  if (all.length === 1) return all[0]
  return and(...all)
}
