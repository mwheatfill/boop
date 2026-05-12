import { and, eq } from 'drizzle-orm'
import type { Database } from '@/lib/db/client'
import { newId } from '@/lib/db/ids'
import { customers, jobs, runs } from '@/lib/db/schema'
import { logInfo, logWarn } from '@/lib/log'
import { listActiveSecrets } from '@/lib/webhook-secrets/queries'
import { verifyWebhook } from '@/lib/webhook-signing/verify'
import type { DispatchMessage } from './scheduled'

export interface WebhookDeps {
  db: Database
  dispatchQueue: Queue<DispatchMessage>
  rateLimit: Pick<RateLimit, 'limit'>
  now?: () => Date
}

const NOT_FOUND_MESSAGE = 'not found'
const SIGNATURE_HEADER = 'X-Boop-Signature'

function clientIp(request: Request): string | null {
  return request.headers.get('cf-connecting-ip') ?? request.headers.get('x-forwarded-for')
}

export async function handleWebhook(
  { db, dispatchQueue, rateLimit, now = () => new Date() }: WebhookDeps,
  request: Request,
  customerSlug: string,
  jobSlug: string,
): Promise<Response> {
  const ip = clientIp(request)

  const { success: allowed } = await rateLimit.limit({ key: customerSlug })
  if (!allowed) {
    logWarn('webhook.rate_limited', { customerSlug, jobSlug, ip })
    return Response.json({ error: 'rate_limit_exceeded' }, { status: 429 })
  }

  const [row] = await db
    .select({
      jobId: jobs.id,
      customerId: customers.id,
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

  const body = await request.text()
  const header = request.headers.get(SIGNATURE_HEADER)
  const activeSecrets = await listActiveSecrets(db, row.jobId, now())
  const verification = await verifyWebhook({
    secrets: activeSecrets.map((s) => s.secret),
    header,
    body,
    now: now().getTime(),
  })
  if (!verification.valid) {
    logWarn('webhook.rejected', {
      customerSlug,
      jobSlug,
      reason: verification.reason,
      ip,
    })
    const status =
      verification.reason === 'missing_header' || verification.reason === 'bad_format' ? 401 : 403
    return Response.json({ error: verification.reason }, { status })
  }

  const scheduledAt = now()
  const runId = newId('run')
  await db.insert(runs).values({
    id: runId,
    jobId: row.jobId,
    customerId: row.customerId,
    scheduledAt,
    status: 'scheduled',
    triggerSource: 'webhook',
  })
  await dispatchQueue.send({
    jobId: row.jobId,
    scheduledAt,
    triggerSource: 'webhook',
    runId,
  })
  logInfo('webhook.received', {
    customerSlug,
    jobSlug,
    accepted: true,
    jobId: row.jobId,
    runId,
  })
  return Response.json(
    { accepted: true, runId, scheduledAt: scheduledAt.toISOString() },
    { status: 200 },
  )
}
