import { and, eq } from 'drizzle-orm'
import type { Database } from '@/lib/db/client'
import { customers, jobs } from '@/lib/db/schema'
import { logInfo } from '@/lib/log'
import type { DispatchMessage } from './scheduled'

export interface WebhookDeps {
  db: Database
  dispatchQueue: Queue<DispatchMessage>
  now?: () => Date
}

const NOT_FOUND_MESSAGE = 'not found'

export async function handleWebhook(
  { db, dispatchQueue, now = () => new Date() }: WebhookDeps,
  customerSlug: string,
  jobSlug: string,
): Promise<Response> {
  const [row] = await db
    .select({
      jobId: jobs.id,
      jobStatus: jobs.status,
      triggerKind: jobs.triggerKind,
    })
    .from(jobs)
    .innerJoin(customers, eq(customers.id, jobs.customerId))
    .where(and(eq(customers.slug, customerSlug), eq(jobs.slug, jobSlug)))
    .limit(1)

  if (!row) {
    logInfo('webhook.received', { customerSlug, jobSlug, accepted: false, reason: 'not_found' })
    return Response.json({ error: NOT_FOUND_MESSAGE }, { status: 404 })
  }

  if (row.jobStatus !== 'active') {
    logInfo('webhook.received', {
      customerSlug,
      jobSlug,
      accepted: false,
      reason: `job_${row.jobStatus}`,
    })
    return Response.json({ error: `Job is ${row.jobStatus}` }, { status: 410 })
  }

  if (row.triggerKind !== 'webhook') {
    logInfo('webhook.received', {
      customerSlug,
      jobSlug,
      accepted: false,
      reason: 'trigger_kind_mismatch',
    })
    return Response.json(
      { error: `Job trigger is ${row.triggerKind}, not webhook` },
      { status: 409 },
    )
  }

  const scheduledAt = now()
  await dispatchQueue.send({ jobId: row.jobId, scheduledAt })
  logInfo('webhook.received', { customerSlug, jobSlug, accepted: true, jobId: row.jobId })
  return Response.json({ accepted: true, runId: null }, { status: 202 })
}
