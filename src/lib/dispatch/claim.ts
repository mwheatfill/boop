import { and, eq } from 'drizzle-orm'
import type { Database } from '@/lib/db/client'
import { jobs } from '@/lib/db/schema'

export async function claimJob(db: Database, jobId: string): Promise<string | null> {
  const claimed = await db
    .update(jobs)
    .set({ fireInProgress: true, updatedAt: new Date() })
    .where(and(eq(jobs.id, jobId), eq(jobs.fireInProgress, false)))
    .returning({ id: jobs.id })
  return claimed[0]?.id ?? null
}

export async function releaseJob(db: Database, jobId: string): Promise<void> {
  await db
    .update(jobs)
    .set({ fireInProgress: false, updatedAt: new Date() })
    .where(eq(jobs.id, jobId))
}
