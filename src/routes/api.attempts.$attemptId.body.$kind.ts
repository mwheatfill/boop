import { env } from 'cloudflare:workers'
import { createFileRoute } from '@tanstack/react-router'
import { getRequest } from '@tanstack/react-start/server'
import { eq } from 'drizzle-orm'
import { getCurrentUser } from '@/lib/auth/get-current-user'
import { createDb } from '@/lib/db/client'
import { attempts } from '@/lib/db/schema'

export const Route = createFileRoute('/api/attempts/$attemptId/body/$kind')({
  server: {
    handlers: {
      GET: async ({ params }) => {
        if (params.kind !== 'request' && params.kind !== 'response') {
          return new Response('Bad Request', { status: 400 })
        }
        const request = getRequest()
        const user = await getCurrentUser(request, env)
        if (!user) return new Response('Unauthorized', { status: 401 })
        const db = createDb(env.DB)
        const [row] = await db
          .select({
            requestKey: attempts.requestBodyR2Key,
            responseKey: attempts.responseBodyR2Key,
          })
          .from(attempts)
          .where(eq(attempts.id, params.attemptId))
          .limit(1)
        if (!row) return new Response('Not Found', { status: 404 })
        const key = params.kind === 'request' ? row.requestKey : row.responseKey
        if (!key) return new Response('Not Found', { status: 404 })
        const obj = await env.BODIES.get(key)
        if (!obj) return new Response('Not Found', { status: 404 })
        const headers = new Headers({
          'Content-Type': obj.httpMetadata?.contentType ?? 'application/octet-stream',
          'Content-Length': String(obj.size),
          'Content-Disposition': `attachment; filename="${params.attemptId}-${params.kind}"`,
        })
        return new Response(obj.body, { headers })
      },
    },
  },
})
