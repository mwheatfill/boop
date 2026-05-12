import { createStartHandler, defaultStreamHandler } from '@tanstack/react-start/server'
import { queue } from './lib/dispatch/queue-consumer'
import type { DispatchMessage } from './lib/dispatch/scheduled'
import { scheduled } from './lib/dispatch/scheduled'

const fetchHandler = createStartHandler(defaultStreamHandler)

export default {
  fetch(request) {
    return fetchHandler(request)
  },
  scheduled,
  queue,
} satisfies ExportedHandler<Cloudflare.Env, DispatchMessage>
