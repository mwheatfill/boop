import { env } from 'cloudflare:workers'
import { createMiddleware } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { getCurrentUser } from './get-current-user'

export const authMiddleware = createMiddleware({ type: 'function' }).server(async ({ next }) => {
  const request = getRequest()
  const user = await getCurrentUser(request, env)
  if (!user) {
    throw new Response('Unauthorized', { status: 401 })
  }
  return next({ context: { user } })
})
