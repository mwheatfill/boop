import type { AlertQueueMessage } from '@/lib/alert-queue/types'
import { createDb } from '@/lib/db/client'
import { logError, logInfo } from '@/lib/log'
import { runDispatch } from './dispatch-run'
import {
  ClaimFailedError,
  DispatchError,
  isRetryableDispatchError,
  JobNotDispatchableError,
  RenderError,
  TargetHttpError,
} from './errors'
import type { DispatchMessage } from './scheduled'

const RETRY_BASE_SECONDS = 30

function retryDelaySeconds(attempts: number): number {
  return 2 ** attempts * RETRY_BASE_SECONDS
}

export interface QueueRoute {
  decision: 'ack' | 'retry' | 'rethrow'
  delaySeconds?: number
}

export function classifyError(err: unknown): QueueRoute {
  if (err instanceof ClaimFailedError) return { decision: 'ack' }
  if (err instanceof JobNotDispatchableError) return { decision: 'ack' }
  if (err instanceof RenderError) return { decision: 'ack' }
  if (err instanceof TargetHttpError && err.status < 500) return { decision: 'ack' }
  if (err instanceof DispatchError && isRetryableDispatchError(err)) return { decision: 'retry' }
  return { decision: 'rethrow' }
}

function routeMessage(message: Message<DispatchMessage>, err: unknown): void {
  const route = classifyError(err)
  const { jobId } = message.body
  if (route.decision === 'ack') {
    logInfo('queue.acked_no_retry', {
      jobId,
      error: err instanceof Error ? err.name : 'unknown',
    })
    message.ack()
    return
  }
  if (route.decision === 'retry') {
    const delay = retryDelaySeconds(message.attempts)
    logError('queue.retry_scheduled', err, {
      jobId,
      attempts: message.attempts,
      delaySeconds: delay,
    })
    message.retry({ delaySeconds: delay })
    return
  }
  throw err
}

export interface DispatchQueueEnv {
  DB: D1Database
  BODIES: R2Bucket
  ALERT_QUEUE?: Queue<AlertQueueMessage>
}

export async function handleQueueMessage(
  env: DispatchQueueEnv,
  message: Message<DispatchMessage>,
): Promise<void> {
  const { jobId, scheduledAt, triggerSource, runId } = message.body
  try {
    await runDispatch(
      {
        db: createDb(env.DB),
        bodies: env.BODIES,
        ...(runId && { preCreatedRunId: runId }),
        ...(env.ALERT_QUEUE && { alertQueue: env.ALERT_QUEUE }),
      },
      jobId,
      scheduledAt instanceof Date ? scheduledAt : new Date(scheduledAt),
      triggerSource ?? 'cron',
    )
    message.ack()
  } catch (err) {
    routeMessage(message, err)
  }
}

export async function queue(
  batch: MessageBatch<DispatchMessage>,
  env: DispatchQueueEnv,
  _ctx: ExecutionContext,
): Promise<void> {
  await Promise.all(batch.messages.map((message) => handleQueueMessage(env, message)))
}
