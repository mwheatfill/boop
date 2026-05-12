import type { AlertQueueMessage } from './types'

export async function enqueueAlert(
  queue: Queue<AlertQueueMessage>,
  message: AlertQueueMessage,
): Promise<void> {
  await queue.send(message)
}
