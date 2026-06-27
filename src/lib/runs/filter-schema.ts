import { and, gte, inArray, lte, type SQL, sql } from 'drizzle-orm'
import { attempts, runs, workspaces } from '@/lib/db/schema'
import { z } from '@/shared/schemas/openapi'
import { FAILURE_KINDS, RUN_OUTCOMES, RUN_STATUSES } from '@/shared/schemas/run'

export const TRIGGER_SOURCES = ['cron', 'interval', 'webhook', 'manual'] as const

const RANGE_PRESETS = ['24h', '7d', 'custom'] as const

const csvArray = <T extends string>(values: readonly T[]) =>
  z
    .union([z.string(), z.array(z.enum(values as [T, ...T[]]))])
    .transform((value) => {
      if (typeof value === 'string') {
        if (value === '') return [] as T[]
        const set = new Set<string>(values)
        return value.split(',').flatMap((raw): T[] => {
          const trimmed = raw.trim()
          return set.has(trimmed) ? [trimmed as T] : []
        })
      }
      return value
    })
    .catch([] as T[])
    .optional()

const csvSlugs = z
  .union([z.string(), z.array(z.string())])
  .transform((value): string[] => {
    if (typeof value === 'string') {
      return value.split(',').flatMap((raw) => {
        const trimmed = raw.trim()
        return trimmed ? [trimmed] : []
      })
    }
    return value
  })
  .catch([])
  .optional()

const isoTimestamp = z.iso.datetime().catch('').optional()

export const RunsSearchSchema = z.object({
  workspace: csvSlugs,
  status: csvArray(RUN_STATUSES),
  outcome: csvArray(RUN_OUTCOMES),
  failureKind: csvArray(FAILURE_KINDS),
  triggerSource: csvArray(TRIGGER_SOURCES),
  range: z.enum(RANGE_PRESETS).catch('24h').default('24h'),
  from: isoTimestamp,
  to: isoTimestamp,
  cursor: z.string().catch('').optional(),
})

export type RunsFilters = z.infer<typeof RunsSearchSchema>

interface ResolvedRange {
  from?: Date
  to?: Date
}

export function resolveRange(filters: RunsFilters, now: Date = new Date()): ResolvedRange {
  if (filters.range === '24h') return { from: new Date(now.getTime() - 24 * 60 * 60 * 1000) }
  if (filters.range === '7d') return { from: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) }
  const result: ResolvedRange = {}
  if (filters.from) {
    const parsed = new Date(filters.from)
    if (!Number.isNaN(parsed.getTime())) result.from = parsed
  }
  if (filters.to) {
    const parsed = new Date(filters.to)
    if (!Number.isNaN(parsed.getTime())) result.to = parsed
  }
  return result
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
  if (range.to) conditions.push(lte(runs.startedAt, range.to))

  if (conditions.length === 0) return undefined
  if (conditions.length === 1) return conditions[0]
  return and(...conditions)
}
