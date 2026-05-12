import { createStartHandler, defaultStreamHandler } from '@tanstack/react-start/server'
import { alertQueue } from './lib/alert-queue/consumer'
import type { AlertQueueMessage } from './lib/alert-queue/types'
import { queue as dispatchQueueHandler } from './lib/dispatch/queue-consumer'
import type { DispatchMessage } from './lib/dispatch/scheduled'
import { scheduled } from './lib/dispatch/scheduled'

export { JobAlarm } from './lib/dispatch/job-alarm-do'

const fetchHandler = createStartHandler(defaultStreamHandler)

type QueueBody = DispatchMessage | AlertQueueMessage

function isAlertBatch(batch: MessageBatch<QueueBody>): batch is MessageBatch<AlertQueueMessage> {
  return batch.queue.startsWith('boop-alerts-')
}

export default {
  fetch(request) {
    return fetchHandler(request)
  },
  scheduled,
  async queue(batch, env, ctx) {
    if (isAlertBatch(batch)) {
      await alertQueue(batch, env)
      return
    }
    await dispatchQueueHandler(batch as MessageBatch<DispatchMessage>, env, ctx)
  },
} satisfies ExportedHandler<Cloudflare.Env, QueueBody>
