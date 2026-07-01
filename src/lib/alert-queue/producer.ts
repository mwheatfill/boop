import type { FiringPair } from '@/lib/alert-rules/evaluator'
import type {
  AlertQueueMessage,
  MissedScheduleAlertQueueMessage,
  MissedScheduleFanout,
  RunAlertQueueMessage,
} from './types'

// The single seam where an alert leaves the domain as a queue message. Callers
// hand over what fired (firing rules, missed-schedule sets, a test request); the
// AlertQueueMessage shape and the pair-by-channel fan-out never leave this file.

async function sendAll(
  queue: Queue<AlertQueueMessage>,
  messages: readonly AlertQueueMessage[],
): Promise<number> {
  if (messages.length === 0) return 0
  await queue.sendBatch(messages.map((body) => ({ body })))
  return messages.length
}

// Fan a run's firing rules out to one message per (rule, channel). Rules are
// additive, so a channel shared by two firing rules is alerted once per rule.
// Returns the number of messages enqueued.
export async function enqueueRunAlerts(
  queue: Queue<AlertQueueMessage>,
  runId: string,
  firingPairs: readonly FiringPair[],
): Promise<number> {
  const messages: RunAlertQueueMessage[] = firingPairs.flatMap((pair) =>
    pair.channelIds.map((channelId) => ({
      runId,
      ruleId: pair.ruleId,
      channelId,
      ruleName: pair.ruleName,
      ruleKind: pair.ruleKind,
    })),
  )
  return sendAll(queue, messages)
}

// Fan firing missed-schedule rules out to one message per (rule, channel).
// Returns the number of messages enqueued.
export async function enqueueMissedScheduleAlerts(
  queue: Queue<AlertQueueMessage>,
  fanouts: readonly MissedScheduleFanout[],
): Promise<number> {
  const messages: MissedScheduleAlertQueueMessage[] = fanouts.flatMap((fanout) =>
    fanout.channelIds.map((channelId) => ({
      jobId: fanout.jobId,
      ruleId: fanout.ruleId,
      channelId,
      ruleName: fanout.ruleName,
      ruleKind: 'missed_schedule' as const,
      lastRunAt: fanout.lastRunAt?.toISOString() ?? null,
      silenceThresholdMinutes: fanout.silenceThresholdMinutes,
    })),
  )
  return sendAll(queue, messages)
}

// Synthetic delivery to one channel. The `test` discriminant routes the consumer
// to the synthetic-context path before the run-vs-missed check.
export async function enqueueTestAlert(
  queue: Queue<AlertQueueMessage>,
  channelId: string,
): Promise<void> {
  const message: RunAlertQueueMessage = {
    runId: `test_${channelId}`,
    ruleId: 'test',
    channelId,
    ruleName: 'Channel test',
    ruleKind: 'first_failure',
    test: true,
  }
  await queue.send(message)
}
