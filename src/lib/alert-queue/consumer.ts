import { eq } from 'drizzle-orm'
import { buildAlertContext, buildSyntheticTestContext } from '@/lib/alert-context/build'
import { adapterFor } from '@/lib/channel-adapters/registry'
import type { AdapterResult } from '@/lib/channel-adapters/types'
import type { Database } from '@/lib/db/client'
import { createDb } from '@/lib/db/client'
import {
  alertRules,
  attempts,
  channels,
  customers,
  jobs,
  runs,
  targets,
} from '@/lib/db/schema'
import { logError, logInfo } from '@/lib/log'
import { rowToChannel } from '@/lib/channels/row-mapper'
import type { AlertQueueMessage } from './types'

const RETRY_BASE_SECONDS = 60

function retryDelaySeconds(attempts: number): number {
  return 2 ** Math.min(attempts, 6) * RETRY_BASE_SECONDS
}

async function loadChannel(db: Database, channelId: string) {
  const row = (await db.select().from(channels).where(eq(channels.id, channelId)).limit(1))[0]
  return row ? rowToChannel(row) : null
}

async function loadCustomer(db: Database, customerId: string) {
  return (await db.select().from(customers).where(eq(customers.id, customerId)).limit(1))[0]
}

async function loadRunBundle(db: Database, runId: string) {
  const row = (
    await db
      .select({ run: runs, job: jobs, customer: customers, target: targets })
      .from(runs)
      .innerJoin(jobs, eq(jobs.id, runs.jobId))
      .innerJoin(customers, eq(customers.id, runs.customerId))
      .innerJoin(targets, eq(targets.id, jobs.targetId))
      .where(eq(runs.id, runId))
      .limit(1)
  )[0]
  if (!row) return null
  const attemptRows = await db.select().from(attempts).where(eq(attempts.runId, runId))
  return { ...row, attempts: attemptRows }
}

async function markChannelDelivered(db: Database, channelId: string, now: Date) {
  await db
    .update(channels)
    .set({ lastUsedAt: now, updatedAt: now })
    .where(eq(channels.id, channelId))
}

async function markChannelTestResult(
  db: Database,
  channelId: string,
  result: AdapterResult,
  now: Date,
) {
  await db
    .update(channels)
    .set({
      lastTestAlertAt: now,
      lastTestAlertStatus: result.ok ? 'delivered' : 'failed',
      lastTestAlertReason: result.ok ? null : result.reason,
      updatedAt: now,
    })
    .where(eq(channels.id, channelId))
}

async function markRuleFired(db: Database, ruleId: string, now: Date) {
  await db
    .update(alertRules)
    .set({ lastFiredAt: now, updatedAt: now })
    .where(eq(alertRules.id, ruleId))
}

function ackTerminal(
  message: Message<AlertQueueMessage>,
  result: AdapterResult,
  fields: Record<string, unknown>,
) {
  if (result.ok) {
    logInfo('alert.delivered', fields)
  } else {
    logError('alert.failed', new Error(result.reason), { ...fields, retryable: result.retryable })
  }
  message.ack()
}

interface ConsumerDeps {
  db: Database
  appOrigin: string
}

async function processTestMessage(
  { db, appOrigin }: ConsumerDeps,
  message: Message<AlertQueueMessage>,
): Promise<void> {
  const channel = await loadChannel(db, message.body.channelId)
  if (!channel) {
    logError('alert.failed', new Error('channel_missing'), {
      channelId: message.body.channelId,
      test: true,
    })
    message.ack()
    return
  }
  const customer = await loadCustomer(db, channel.customerId)
  const alertContext = buildSyntheticTestContext(
    channel.name,
    channel.slug,
    customer?.name ?? 'Unknown',
    customer?.slug ?? 'unknown',
    appOrigin,
  )
  const now = new Date()
  const result = await adapterFor(channel.kind)({ channel, alertContext })
  await markChannelTestResult(db, channel.id, result, now)
  if (result.ok) await markChannelDelivered(db, channel.id, now)
  const fields = {
    channelId: channel.id,
    channelKind: channel.kind,
    customerSlug: customer?.slug,
    test: true,
    attemptNumber: message.attempts,
  }
  if (!result.ok && result.retryable && message.attempts < 5) {
    logError('alert.retry_scheduled', new Error(result.reason), fields)
    message.retry({ delaySeconds: retryDelaySeconds(message.attempts) })
    return
  }
  ackTerminal(message, result, fields)
}

async function processRealMessage(
  { db, appOrigin }: ConsumerDeps,
  message: Message<AlertQueueMessage>,
): Promise<void> {
  const channel = await loadChannel(db, message.body.channelId)
  const bundle = await loadRunBundle(db, message.body.runId)
  const fields = {
    runId: message.body.runId,
    ruleId: message.body.ruleId,
    channelId: message.body.channelId,
    attemptNumber: message.attempts,
  }
  if (!channel || !bundle) {
    logError(
      'alert.failed',
      new Error(!channel ? 'channel_missing' : 'run_missing'),
      fields,
    )
    message.ack()
    return
  }
  const alertContext = buildAlertContext({
    run: bundle.run,
    attempts: bundle.attempts,
    job: bundle.job,
    customer: bundle.customer,
    target: bundle.target,
    ruleName: message.body.ruleName,
    ruleKind: message.body.ruleKind,
    appOrigin,
  })
  const now = new Date()
  const result = await adapterFor(channel.kind)({ channel, alertContext })
  const enriched = {
    ...fields,
    channelKind: channel.kind,
    customerSlug: bundle.customer.slug,
    jobSlug: bundle.job.slug,
  }
  if (result.ok) {
    await Promise.all([
      markChannelDelivered(db, channel.id, now),
      markRuleFired(db, message.body.ruleId, now),
    ])
    ackTerminal(message, result, enriched)
    return
  }
  if (result.retryable && message.attempts < 5) {
    logError('alert.retry_scheduled', new Error(result.reason), enriched)
    message.retry({ delaySeconds: retryDelaySeconds(message.attempts) })
    return
  }
  ackTerminal(message, result, enriched)
}

export async function handleAlertMessage(
  deps: ConsumerDeps,
  message: Message<AlertQueueMessage>,
): Promise<void> {
  if (message.body.test) {
    await processTestMessage(deps, message)
    return
  }
  await processRealMessage(deps, message)
}

export interface AlertQueueEnv {
  DB: D1Database
  PUBLIC_APP_ORIGIN: string
}

export async function alertQueue(
  batch: MessageBatch<AlertQueueMessage>,
  env: AlertQueueEnv,
): Promise<void> {
  const db = createDb(env.DB)
  for (const message of batch.messages) {
    try {
      await handleAlertMessage({ db, appOrigin: env.PUBLIC_APP_ORIGIN }, message)
    } catch (err) {
      logError('alert.consumer_unhandled', err, {
        runId: message.body.runId,
        channelId: message.body.channelId,
        attemptNumber: message.attempts,
      })
      message.ack()
    }
  }
}
