import type { AlertQueueMessage } from './types'

export async function enqueueAlert(
  queue: Queue<AlertQueueMessage>,
  message: AlertQueueMessage,
): Promise<void> {
  await queue.send(message)
}

export async function enqueueAlertBatch(
  queue: Queue<AlertQueueMessage>,
  messages: readonly AlertQueueMessage[],
): Promise<void> {
  if (messages.length === 0) return
  await queue.sendBatch(messages.map((body) => ({ body })))
}
