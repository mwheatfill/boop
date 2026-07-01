import { and, gte, inArray, type SQL, sql } from 'drizzle-orm'
import { attempts, runs, workspaces } from '@/lib/db/schema'
import { type RunsFilters, RunsSearchSchema, TRIGGER_SOURCES } from '@/shared/schemas/run-filters'

// The runs filter contract lives in the shared schema layer so it enters
// openapi.json; the query-building logic below stays here beside the DB layer.
export { type RunsFilters, RunsSearchSchema, TRIGGER_SOURCES }

const RANGE_RE = /^(\d+)(m|h|d|w|mo)$/
const RANGE_UNIT_MS: Record<string, number> = {
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
  w: 604_800_000,
  mo: 30 * 86_400_000,
}

// A range is "all" or "<N><unit>" (e.g. 24h, 7d, 45m, 3mo), a sliding window
// computed at query time. Presets and custom relative ranges share this form.
export function rangeToMs(range: string): number | null {
  const m = RANGE_RE.exec(range)
  const unit = m?.[2]
  if (!m || unit === undefined) return null
  return Number(m[1]) * (RANGE_UNIT_MS[unit] ?? 0)
}

interface ResolvedRange {
  from?: Date
}

export function resolveRange(filters: RunsFilters, now: Date = new Date()): ResolvedRange {
  if (filters.range === 'all') return {}
  const ms = rangeToMs(filters.range) ?? 24 * 60 * 60 * 1000
  return { from: new Date(now.getTime() - ms) }
}

export function filtersToWhere(filters: RunsFilters, now: Date = new Date()): SQL | undefined {
  const conditions: SQL[] = []

  if (filters.workspace && filters.workspace.length > 0) {
    conditions.push(inArray(workspaces.slug, filters.workspace))
  }
  if (filters.status && filters.status.length > 0) {
    conditions.push(inArray(runs.status, filters.status))
  }
  if (filters.outcome && filters.outcome.length > 0) {
    conditions.push(inArray(runs.outcome, filters.outcome))
  }
  if (filters.triggerSource && filters.triggerSource.length > 0) {
    conditions.push(inArray(runs.triggerSource, filters.triggerSource))
  }
  if (filters.failureKind && filters.failureKind.length > 0) {
    conditions.push(
      sql`EXISTS (SELECT 1 FROM ${attempts} WHERE ${attempts.runId} = ${runs.id} AND ${inArray(attempts.failureKind, filters.failureKind)})`,
    )
  }

  const range = resolveRange(filters, now)
  if (range.from) conditions.push(gte(runs.startedAt, range.from))

  if (conditions.length === 0) return undefined
  if (conditions.length === 1) return conditions[0]
  return and(...conditions)
}
