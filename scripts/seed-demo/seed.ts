import { sql } from 'drizzle-orm'
import type { SQLiteTable } from 'drizzle-orm/sqlite-core'
import { getTableColumns } from 'drizzle-orm/utils'
import type { Database } from '@/lib/db/client'
import {
  alertRules,
  attempts,
  channels,
  jobs,
  runs,
  targets,
  users,
  workspaces,
} from '@/lib/db/schema'
import { alertRuleRow, DEMO_ALERT_RULES } from './alert-rules'
import { channelRow, DEMO_CHANNELS } from './channels'
import { DEMO_JOBS, jobRow } from './jobs'
import { isProfile, PROFILES, type Profile } from './manifest'
import { DEMO_OPERATORS, operatorRow } from './operators'
import { createPrng } from './prng'
import { generateRunsForJob } from './runs'
import { DEMO_TARGETS, targetRow } from './targets'
import { DEMO_WORKSPACES, workspaceRow } from './workspaces'

export type SeedOptions = {
  profile: Profile
  now?: Date
  onProgress?: (event: SeedProgressEvent) => void
}

export type SeedProgressEvent = {
  kind: 'phase' | 'progress'
  message: string
  rows?: number
}

export type SeedCounts = {
  workspaces: number
  operators: number
  targets: number
  jobs: number
  channels: number
  alertRules: number
  runs: number
  attempts: number
}

const BATCH_INSERT_SIZE = 250

export async function seedDemoData(db: Database, options: SeedOptions): Promise<SeedCounts> {
  if (!isProfile(options.profile)) {
    throw new Error(`Unknown profile: ${options.profile}`)
  }
  const now = options.now ?? new Date()
  const profile = PROFILES[options.profile]
  const log = options.onProgress ?? (() => {})

  const workspaceSpecs = filterByField(DEMO_WORKSPACES, 'slug', profile.workspaceSlugs)
  const workspaceSlugSet = new Set(workspaceSpecs.map((c) => c.slug))
  const jobSpecsAll = DEMO_JOBS.filter((j) => workspaceSlugSet.has(j.workspaceSlug))
  const jobSpecs = filterByField(jobSpecsAll, 'slug', profile.jobSlugs)
  const allowedJobSlugSet = new Set(jobSpecs.map((j) => j.slug))
  const targetSpecs = DEMO_TARGETS.filter((t) => workspaceSlugSet.has(t.workspaceSlug))
  const channelSpecs = DEMO_CHANNELS.filter((c) => workspaceSlugSet.has(c.workspaceSlug))
  const alertRuleSpecs = DEMO_ALERT_RULES.filter(
    (r) =>
      workspaceSlugSet.has(r.workspaceSlug) &&
      (r.jobSlug === null || allowedJobSlugSet.has(r.jobSlug)),
  )

  log({ kind: 'phase', message: 'Upserting Workspaces' })
  const workspaceRows = workspaceSpecs.map((c) => workspaceRow(c, now))
  await upsertBatched(db, workspaces, workspaceRows)
  const workspaceIdBySlug = new Map<string, string>()
  const workspaceCreatedAtBySlug = new Map<string, Date>()
  for (const row of workspaceRows) {
    workspaceIdBySlug.set(row.slug, row.id)
    workspaceCreatedAtBySlug.set(row.slug, row.createdAt as Date)
  }

  log({ kind: 'phase', message: 'Upserting Operators' })
  const operatorRows = DEMO_OPERATORS.map((o) => operatorRow(o, now))
  await upsertBatched(db, users, operatorRows)

  log({ kind: 'phase', message: 'Upserting Targets' })
  const targetRows: ReturnType<typeof targetRow>[] = []
  const targetIdByKey = new Map<string, string>()
  for (const t of targetSpecs) {
    const cId = workspaceIdBySlug.get(t.workspaceSlug)
    if (!cId) throw new Error(`Target ${t.slug} references unknown Workspace ${t.workspaceSlug}`)
    const createdAt = workspaceCreatedAtBySlug.get(t.workspaceSlug) ?? now
    const row = targetRow(t, cId, createdAt)
    targetRows.push(row)
    targetIdByKey.set(targetKey(t.workspaceSlug, t.slug), row.id)
  }
  await upsertBatched(db, targets, targetRows)

  log({ kind: 'phase', message: 'Upserting Jobs' })
  const jobRows: ReturnType<typeof jobRow>[] = []
  const jobIdBySlug = new Map<string, string>()
  for (const j of jobSpecs) {
    const cId = workspaceIdBySlug.get(j.workspaceSlug)
    if (!cId) throw new Error(`Job ${j.slug} references unknown Workspace ${j.workspaceSlug}`)
    const tId = targetIdByKey.get(targetKey(j.workspaceSlug, j.targetSlug))
    if (!tId) {
      throw new Error(`Job ${j.slug} references unknown Target ${j.workspaceSlug}/${j.targetSlug}`)
    }
    const createdAt = workspaceCreatedAtBySlug.get(j.workspaceSlug) ?? now
    const row = jobRow(j, cId, tId, createdAt)
    jobRows.push(row)
    jobIdBySlug.set(jobKey(j.workspaceSlug, j.slug), row.id)
  }
  await upsertBatched(db, jobs, jobRows)

  log({ kind: 'phase', message: 'Upserting Channels' })
  const channelRows: ReturnType<typeof channelRow>[] = []
  const channelIdByKey = new Map<string, string>()
  for (const c of channelSpecs) {
    const cId = workspaceIdBySlug.get(c.workspaceSlug)
    if (!cId) throw new Error(`Channel ${c.slug} references unknown Workspace ${c.workspaceSlug}`)
    const createdAt = workspaceCreatedAtBySlug.get(c.workspaceSlug) ?? now
    const row = channelRow(c, cId, createdAt)
    channelRows.push(row)
    channelIdByKey.set(channelKey(c.workspaceSlug, c.slug), row.id)
  }
  await upsertBatched(db, channels, channelRows)

  log({ kind: 'phase', message: 'Upserting AlertRules' })
  const alertRuleRows: ReturnType<typeof alertRuleRow>[] = []
  for (const r of alertRuleSpecs) {
    const cId = workspaceIdBySlug.get(r.workspaceSlug)
    if (!cId) continue
    const jId = r.jobSlug ? (jobIdBySlug.get(jobKey(r.workspaceSlug, r.jobSlug)) ?? null) : null
    const channelIds = r.channelSlugs.flatMap((slug) => {
      const id = channelIdByKey.get(channelKey(r.workspaceSlug, slug))
      return id ? [id] : []
    })
    const createdAt = workspaceCreatedAtBySlug.get(r.workspaceSlug) ?? now
    alertRuleRows.push(alertRuleRow(r, cId, jId, channelIds, createdAt))
  }
  await upsertBatched(db, alertRules, alertRuleRows)

  log({ kind: 'phase', message: `Generating Runs for ${jobSpecs.length} Jobs` })
  const windowEnd = now
  const windowStart = new Date(windowEnd.getTime() - profile.historyDays * 86400_000)

  const workspaceTimezoneBySlug = new Map(workspaceSpecs.map((c) => [c.slug, c.timezone]))

  const generated = await Promise.all(
    jobSpecs.map(async (spec) => {
      const jobId = jobIdBySlug.get(jobKey(spec.workspaceSlug, spec.slug))
      const workspaceId = workspaceIdBySlug.get(spec.workspaceSlug)
      if (!jobId || !workspaceId) return { runs: 0, attempts: 0 }
      const workspaceTimezone = workspaceTimezoneBySlug.get(spec.workspaceSlug) ?? 'America/Phoenix'
      const { runs: runRows, attempts: attemptRows } = generateRunsForJob(
        {
          spec,
          jobId,
          workspaceId,
          workspaceSlug: spec.workspaceSlug,
          workspaceTimezone,
        },
        windowStart,
        windowEnd,
      )

      if (runRows.length === 0) return { runs: 0, attempts: 0 }
      await insertBatched(db, runs, runRows)
      await insertBatched(db, attempts, attemptRows)
      log({ kind: 'progress', message: `${spec.workspaceSlug}/${spec.slug}`, rows: runRows.length })
      return { runs: runRows.length, attempts: attemptRows.length }
    }),
  )
  const totalRuns = generated.reduce((total, item) => total + item.runs, 0)
  const totalAttempts = generated.reduce((total, item) => total + item.attempts, 0)

  // Stamp recent alert-firing signals so the alerts surface shows life.
  await stampRecentAlertSignals(db, alertRuleRows, channelRows, windowEnd)

  return {
    workspaces: workspaceRows.length,
    operators: operatorRows.length,
    targets: targetRows.length,
    jobs: jobRows.length,
    channels: channelRows.length,
    alertRules: alertRuleRows.length,
    runs: totalRuns,
    attempts: totalAttempts,
  }
}

async function stampRecentAlertSignals(
  db: Database,
  alertRuleRows: ReadonlyArray<{ id: string }>,
  channelRows: ReadonlyArray<{ id: string }>,
  windowEnd: Date,
): Promise<void> {
  const rng = createPrng('boop:demo:alert-signals')
  // ~70% of rules have fired recently; pick a timestamp within the last 14 days.
  await Promise.all(
    alertRuleRows.map(async (r) => {
      if (!rng.bool(0.7)) return
      const hoursAgo = rng.int(1, 14 * 24)
      const ts = new Date(windowEnd.getTime() - hoursAgo * 3600_000)
      await db
        .update(alertRules)
        .set({ lastFiredAt: ts, updatedAt: ts })
        .where(sql`${alertRules.id} = ${r.id}`)
    }),
  )

  await Promise.all(
    channelRows.map(async (c) => {
      if (!rng.bool(0.6)) return
      const hoursAgo = rng.int(1, 14 * 24)
      const ts = new Date(windowEnd.getTime() - hoursAgo * 3600_000)
      const isTested = rng.bool(0.4)
      await db
        .update(channels)
        .set({
          lastUsedAt: ts,
          ...(isTested
            ? {
                lastTestAlertAt: new Date(ts.getTime() - rng.int(0, 86400_000)),
                lastTestAlertStatus: rng.bool(0.9) ? 'delivered' : 'failed',
                lastTestAlertReason: null,
              }
            : {}),
          updatedAt: ts,
        })
        .where(sql`${channels.id} = ${c.id}`)
    }),
  )
}

// Drizzle's generic insert is variadic over table shape; the seed orchestrator
// passes pre-validated rows through, so we widen to `any` at this boundary only.
type AnyDb = {
  insert: (table: SQLiteTable) => {
    values: (rows: ReadonlyArray<Record<string, unknown>>) => {
      onConflictDoUpdate: (args: { target: unknown; set: Record<string, unknown> }) => Promise<void>
      onConflictDoNothing: (args: { target: unknown }) => Promise<void>
    }
  }
}

async function upsertBatched<T extends SQLiteTable>(
  db: Database,
  table: T,
  rows: ReadonlyArray<Record<string, unknown>>,
): Promise<void> {
  if (rows.length === 0) return
  const cols = getTableColumns(table) as Record<string, { name: string }>
  const target = cols.id
  if (!target) throw new Error(`upsertBatched: table ${String(table)} has no id column`)
  const update: Record<string, unknown> = {}
  for (const [key, col] of Object.entries(cols)) {
    if (key === 'id' || key === 'createdAt') continue
    update[key] = sql.raw(`excluded.${col.name}`)
  }
  await Promise.all(
    chunkedRows(rows).map((slice) =>
      (db as unknown as AnyDb)
        .insert(table)
        .values(slice)
        .onConflictDoUpdate({ target, set: update }),
    ),
  )
}

async function insertBatched<T extends SQLiteTable>(
  db: Database,
  table: T,
  rows: ReadonlyArray<Record<string, unknown>>,
): Promise<void> {
  if (rows.length === 0) return
  const cols = getTableColumns(table) as Record<string, { name: string }>
  const target = cols.id
  if (!target) throw new Error(`insertBatched: table ${String(table)} has no id column`)
  await Promise.all(
    chunkedRows(rows).map((slice) =>
      (db as unknown as AnyDb).insert(table).values(slice).onConflictDoNothing({ target }),
    ),
  )
}

function chunkedRows(
  rows: ReadonlyArray<Record<string, unknown>>,
): Array<ReadonlyArray<Record<string, unknown>>> {
  const chunks: Array<ReadonlyArray<Record<string, unknown>>> = []
  for (let i = 0; i < rows.length; i += BATCH_INSERT_SIZE) {
    chunks.push(rows.slice(i, i + BATCH_INSERT_SIZE))
  }
  return chunks
}

function filterByField<T extends Record<string, unknown>, K extends keyof T>(
  items: readonly T[],
  field: K,
  allow: 'all' | readonly string[],
): T[] {
  if (allow === 'all') return [...items]
  const allowSet = new Set(allow)
  return items.filter((item) => allowSet.has(item[field] as string))
}

function targetKey(workspaceSlug: string, slug: string): string {
  return `${workspaceSlug}/${slug}`
}
function jobKey(workspaceSlug: string, slug: string): string {
  return `${workspaceSlug}/${slug}`
}
function channelKey(workspaceSlug: string, slug: string): string {
  return `${workspaceSlug}/${slug}`
}
