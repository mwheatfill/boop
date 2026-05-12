import { env } from 'cloudflare:workers'
import { createFileRoute } from '@tanstack/react-router'
import { createDb } from '@/lib/db/client'
import { handleWebhook } from '@/lib/dispatch/webhook'

export const Route = createFileRoute('/w/$customer/$slug')({
  server: {
    handlers: {
      POST: async ({ params }) =>
        handleWebhook(
          { db: createDb(env.DB), dispatchQueue: env.DISPATCH_QUEUE },
          params.customer,
          params.slug,
        ),
    },
  },
})
