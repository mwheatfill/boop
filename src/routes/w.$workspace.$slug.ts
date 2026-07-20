import { env } from 'cloudflare:workers'
import { createFileRoute } from '@tanstack/react-router'
import { createDb } from '@/lib/db/client'
import { handleWebhook } from '@/lib/dispatch/webhook'

export const Route = createFileRoute('/w/$workspace/$slug')({
  server: {
    handlers: {
      POST: async ({ params, request }) =>
        handleWebhook(
          {
            db: createDb(env.DB),
            dispatchQueue: env.DISPATCH_QUEUE,
            rateLimit: env.WEBHOOK_RATE_LIMIT,
            kek: (await env.BOOP_SECRETS_KEK?.get()) ?? undefined,
          },
          request,
          params.workspace,
          params.slug,
        ),
    },
  },
})
