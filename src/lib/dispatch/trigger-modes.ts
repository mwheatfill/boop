import { eq } from 'drizzle-orm'
import { createDb, type Database } from '@/lib/db/client'
import { jobs, workspaces } from '@/lib/db/schema'
import { logError } from '@/lib/log'

export interface TriggerEnv {
  DB: D1Database
  JOB_ALARM: DurableObjectNamespace
}

interface JobLocation {
  workspaceId: string
  intervalSeconds: number | null
}

async function readJobLocation(db: Database, jobId: string): Promise<JobLocation | null> {
  const [row] = await db
    .select({ workspaceId: jobs.workspaceId, intervalSeconds: jobs.intervalSeconds })
    .from(jobs)
    .innerJoin(workspaces, eq(workspaces.id, jobs.workspaceId))
    .where(eq(jobs.id, jobId))
    .limit(1)
  return row ?? null
}

function alarmName(workspaceId: string, jobId: string): string {
  return `${workspaceId}:${jobId}`
}

export async function enterIntervalMode(env: TriggerEnv, jobId: string): Promise<void> {
  const db = createDb(env.DB)
  const location = await readJobLocation(db, jobId)
  if (!location || location.intervalSeconds == null) {
    throw new Error(`Job ${jobId} is not configured for interval mode`)
  }
  const stub = env.JOB_ALARM.get(env.JOB_ALARM.idFromName(alarmName(location.workspaceId, jobId)))
  const res = await stub.fetch('http://job-alarm/seed', {
    method: 'POST',
    body: JSON.stringify({ jobId, intervalSeconds: location.intervalSeconds }),
  })
  if (!res.ok) {
    logError('trigger-modes.seed_failed', new Error(`status=${res.status}`), { jobId })
    throw new Error(`Failed to seed JobAlarm: ${res.status}`)
  }
}

async function clearAlarm(env: TriggerEnv, jobId: string): Promise<void> {
  const db = createDb(env.DB)
  const location = await readJobLocation(db, jobId)
  if (!location) return
  const stub = env.JOB_ALARM.get(env.JOB_ALARM.idFromName(alarmName(location.workspaceId, jobId)))
  const res = await stub.fetch('http://job-alarm/cancel', { method: 'POST' })
  if (!res.ok) {
    logError('trigger-modes.cancel_failed', new Error(`status=${res.status}`), { jobId })
  }
  await db.update(jobs).set({ nextFireAt: null, updatedAt: new Date() }).where(eq(jobs.id, jobId))
}

export async function enterCronMode(env: TriggerEnv, jobId: string): Promise<void> {
  await clearAlarm(env, jobId)
}

export async function enterWebhookMode(env: TriggerEnv, jobId: string): Promise<void> {
  await clearAlarm(env, jobId)
}

export async function enterManualMode(env: TriggerEnv, jobId: string): Promise<void> {
  await clearAlarm(env, jobId)
}
