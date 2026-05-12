import { eq } from 'drizzle-orm'
import type { Database } from '@/lib/db/client'
import { jobs } from '@/lib/db/schema'
import { logError, logInfo } from '@/lib/log'

export interface JobAlarmStorage {
  setAlarm(scheduledTime: number | Date): Promise<void> | void
  deleteAlarm(): Promise<void> | void
  getAlarm(): Promise<number | null>
  get<T = unknown>(key: string): Promise<T | undefined>
  put(key: string, value: unknown): Promise<void>
  delete(key: string): Promise<unknown>
}

export interface JobAlarmDeps {
  storage: JobAlarmStorage
  readJob: (jobId: string) => Promise<JobAlarmRow | null>
  runDispatch: (jobId: string, scheduledAt: Date) => Promise<void>
  now?: () => Date
}

export interface JobAlarmRow {
  status: 'active' | 'paused' | 'archived'
  triggerKind: 'cron' | 'interval' | 'webhook'
  intervalSeconds: number | null
}

export interface SeedPayload {
  jobId: string
  intervalSeconds: number
}

export async function readJobLite(db: Database, jobId: string): Promise<JobAlarmRow | null> {
  const [row] = await db
    .select({
      status: jobs.status,
      triggerKind: jobs.triggerKind,
      intervalSeconds: jobs.intervalSeconds,
    })
    .from(jobs)
    .where(eq(jobs.id, jobId))
    .limit(1)
  return row ?? null
}

export async function handleSeed(
  { storage, now = () => new Date() }: Pick<JobAlarmDeps, 'storage' | 'now'>,
  payload: SeedPayload,
): Promise<void> {
  if (payload.intervalSeconds <= 0) {
    throw new Error('intervalSeconds must be a positive integer')
  }
  await storage.put('jobId', payload.jobId)
  await storage.put('intervalSeconds', payload.intervalSeconds)
  await storage.setAlarm(now().getTime() + payload.intervalSeconds * 1000)
  logInfo('job-alarm.seeded', { jobId: payload.jobId, intervalSeconds: payload.intervalSeconds })
}

export async function handleCancel({ storage }: Pick<JobAlarmDeps, 'storage'>): Promise<void> {
  await storage.deleteAlarm()
  const jobId = await storage.get<string>('jobId')
  await storage.delete('jobId')
  await storage.delete('intervalSeconds')
  logInfo('job-alarm.canceled', { jobId: jobId ?? null })
}

export async function handleAlarm(
  { storage, readJob, runDispatch, now = () => new Date() }: JobAlarmDeps,
  alarmInfo?: { retryCount?: number },
): Promise<void> {
  const jobId = await storage.get<string>('jobId')
  if (!jobId) {
    logInfo('job-alarm.fired_without_state', { retryCount: alarmInfo?.retryCount ?? 0 })
    return
  }
  const intervalSeconds = await storage.get<number>('intervalSeconds')
  const tick = now()
  logInfo('job-alarm.fired', { jobId, retryCount: alarmInfo?.retryCount ?? 0 })

  const job = await readJob(jobId)
  if (
    !job ||
    job.status !== 'active' ||
    job.triggerKind !== 'interval' ||
    job.intervalSeconds == null
  ) {
    logInfo('job-alarm.skipped', {
      jobId,
      reason: !job ? 'not_found' : `status=${job.status}/kind=${job.triggerKind}`,
    })
    return
  }

  try {
    await runDispatch(jobId, tick)
  } catch (err) {
    logError('job-alarm.dispatch_failed', err, { jobId })
  }
  const effectiveInterval = job.intervalSeconds ?? intervalSeconds ?? 0
  if (effectiveInterval > 0) {
    await storage.setAlarm(now().getTime() + effectiveInterval * 1000)
  }
}
