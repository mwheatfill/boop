import { env } from 'cloudflare:workers'
import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { getCurrentUser } from './get-current-user'

// Intentionally unguarded: this is the source of truth for "is the caller
// authenticated?" — wrapping it in authMiddleware would 401 the very request
// that the root beforeLoad uses to decide whether to redirect to /login.
export const getCurrentUserFn = createServerFn({ method: 'GET' }).handler(async () => {
  const request = getRequest()
  return await getCurrentUser(request, env)
})
