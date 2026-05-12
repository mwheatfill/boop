import { createMiddleware } from '@tanstack/react-start'
import { authMiddleware } from './auth-middleware'
import { requireAdmin } from './require-admin'

export const adminMiddleware = createMiddleware({ type: 'function' })
  .middleware([authMiddleware])
  .server(async ({ next, context }) => {
    return next({ context: { user: requireAdmin(context.user) } })
  })
