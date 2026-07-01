import { eq } from 'drizzle-orm'
import {
  buildAlertContext,
  buildMissedAlertContext,
  buildSyntheticTestContext,
} from '@/lib/alert-context/build'
import { adapterFor, type ChannelAdapter } from '@/lib/channel-adapters/registry'
import type { AdapterResult } from '@/lib/channel-adapters/types'
import { findChannelById } from '@/lib/channels/queries'
import type { Database } from '@/lib/db/client'
import { createDb } from '@/lib/db/client'
import { alertRules, attempts, channels, jobs, runs, targets, workspaces } from '@/lib/db/schema'
import { logError, logInfo } from '@/lib/log'
import type { ChannelKind } from '@/shared/schemas/channel'
import { decideDisposition } from './disposition'
import {
  type AlertQueueMessage,
  isRunAlertMessage,
  type MissedScheduleAlertQueueMessage,
  type RunAlertQueueMessage,
} from './types'

async function loadWorkspace(db: Database, workspaceId: string) {
  return (await db.select().from(workspaces).where(eq(workspaces.id, workspaceId)).limit(1))[0]
}

async function loadRunBundle(db: Database, runId: string) {
  const row = (
    await db
      .select({ run: runs, job: jobs, workspace: workspaces, target: targets })
      .from(runs)
      .innerJoin(jobs, eq(jobs.id, runs.jobId))
      .innerJoin(workspaces, eq(workspaces.id, runs.workspaceId))
      .innerJoin(targets, eq(targets.id, jobs.targetId))
      .where(eq(runs.id, runId))
      .limit(1)
  )[0]
  if (!row) return null
  const attemptRows = await db.select().from(attempts).where(eq(attempts.runId, runId))
  return { ...row, attempts: attemptRows }
}

async function loadJobBundle(db: Database, jobId: string) {
  return (
    await db
      .select({ job: jobs, workspace: workspaces })
      .from(jobs)
      .innerJoin(workspaces, eq(workspaces.id, jobs.workspaceId))
      .where(eq(jobs.id, jobId))
      .limit(1)
  )[0]
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

async function markAlertDelivered(
  db: Database,
  channelId: string,
  ruleId: string,
  now: Date,
): Promise<void> {
  await Promise.all([markChannelDelivered(db, channelId, now), markRuleFired(db, ruleId, now)])
}

function routeAdapterResult(
  message: Message<AlertQueueMessage>,
  result: AdapterResult,
  fields: Record<string, unknown>,
) {
  const disposition = decideDisposition(result, message.attempts)
  if (result.ok) {
    logInfo('alert.delivered', fields)
  } else if ('retry' in disposition) {
    logError('alert.retry_scheduled', new Error(result.reason), fields)
  } else {
    logError('alert.failed', new Error(result.reason), { ...fields, retryable: result.retryable })
  }
  if ('retry' in disposition) {
    message.retry({ delaySeconds: disposition.delaySeconds })
  } else {
    message.ack()
  }
}

export interface ConsumerDeps {
  db: Database
  appOrigin: string
  adapterFor: (kind: ChannelKind) => ChannelAdapter
}

async function processTestMessage(
  { db, appOrigin, adapterFor }: ConsumerDeps,
  message: Message<AlertQueueMessage>,
): Promise<void> {
  const channel = await findChannelById(db, message.body.channelId)
  if (!channel) {
    logError('alert.failed', new Error('channel_missing'), {
      channelId: message.body.channelId,
      test: true,
    })
    message.ack()
    return
  }
  const workspace = await loadWorkspace(db, channel.workspaceId)
  const alertContext = buildSyntheticTestContext(
    channel.name,
    channel.slug,
    workspace?.name ?? 'Workspace',
    workspace?.slug ?? 'workspace',
    appOrigin,
  )
  const now = new Date()
  const result = await adapterFor(channel.kind)(channel.config, alertContext)
  await markChannelTestResult(db, channel.id, result, now)
  if (result.ok) await markChannelDelivered(db, channel.id, now)
  routeAdapterResult(message, result, {
    channelId: channel.id,
    channelKind: channel.kind,
    workspaceSlug: workspace?.slug,
    test: true,
    attemptNumber: message.attempts,
  })
}

async function processRunMessage(
  { db, appOrigin, adapterFor }: ConsumerDeps,
  message: Message<AlertQueueMessage>,
  body: RunAlertQueueMessage,
): Promise<void> {
  const channel = await findChannelById(db, body.channelId)
  const bundle = await loadRunBundle(db, body.runId)
  const fields = {
    runId: body.runId,
    ruleId: body.ruleId,
    channelId: body.channelId,
    attemptNumber: message.attempts,
  }
  if (!channel || !bundle) {
    logError('alert.failed', new Error(!channel ? 'channel_missing' : 'run_missing'), fields)
    message.ack()
    return
  }
  const alertContext = buildAlertContext({
    run: bundle.run,
    attempts: bundle.attempts,
    job: bundle.job,
    workspace: bundle.workspace,
    target: bundle.target,
    ruleName: body.ruleName,
    ruleKind: body.ruleKind,
    appOrigin,
  })
  const now = new Date()
  const result = await adapterFor(channel.kind)(channel.config, alertContext)
  if (result.ok) await markAlertDelivered(db, channel.id, body.ruleId, now)
  routeAdapterResult(message, result, {
    ...fields,
    channelKind: channel.kind,
    workspaceSlug: bundle.workspace.slug,
    jobSlug: bundle.job.slug,
  })
}

async function processMissedMessage(
  { db, appOrigin, adapterFor }: ConsumerDeps,
  message: Message<AlertQueueMessage>,
  body: MissedScheduleAlertQueueMessage,
): Promise<void> {
  const channel = await findChannelById(db, body.channelId)
  const bundle = await loadJobBundle(db, body.jobId)
  const fields = {
    jobId: body.jobId,
    ruleId: body.ruleId,
    channelId: body.channelId,
    attemptNumber: message.attempts,
  }
  if (!channel || !bundle) {
    logError('alert.failed', new Error(!channel ? 'channel_missing' : 'job_missing'), fields)
    message.ack()
    return
  }
  const alertContext = buildMissedAlertContext({
    job: bundle.job,
    workspace: bundle.workspace,
    ruleName: body.ruleName,
    appOrigin,
    lastRunAt: body.lastRunAt,
    silenceThresholdMinutes: body.silenceThresholdMinutes,
  })
  const now = new Date()
  const result = await adapterFor(channel.kind)(channel.config, alertContext)
  if (result.ok) await markAlertDelivered(db, channel.id, body.ruleId, now)
  routeAdapterResult(message, result, {
    ...fields,
    channelKind: channel.kind,
    workspaceSlug: bundle.workspace.slug,
    jobSlug: bundle.job.slug,
  })
}

export async function handleAlertMessage(
  deps: ConsumerDeps,
  message: Message<AlertQueueMessage>,
): Promise<void> {
  if (message.body.test) {
    await processTestMessage(deps, message)
    return
  }
  if (isRunAlertMessage(message.body)) {
    await processRunMessage(deps, message, message.body)
    return
  }
  await processMissedMessage(deps, message, message.body)
}

export interface AlertQueueEnv {
  DB: D1Database
  PUBLIC_APP_ORIGIN: string
}

export async function alertQueue(
  batch: MessageBatch<AlertQueueMessage>,
  env: AlertQueueEnv,
): Promise<void> {
  const deps: ConsumerDeps = {
    db: createDb(env.DB),
    appOrigin: env.PUBLIC_APP_ORIGIN,
    adapterFor,
  }
  await Promise.all(
    batch.messages.map(async (message) => {
      try {
        await handleAlertMessage(deps, message)
      } catch (err) {
        logError('alert.consumer_unhandled', err, {
          runId: isRunAlertMessage(message.body) ? message.body.runId : undefined,
          jobId: isRunAlertMessage(message.body) ? undefined : message.body.jobId,
          channelId: message.body.channelId,
          attemptNumber: message.attempts,
        })
        message.ack()
      }
    }),
  )
}
