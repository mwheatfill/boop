import { env } from 'cloudflare:workers'
import { createServerFn } from '@tanstack/react-start'
import { authMiddleware } from '@/lib/auth/auth-middleware'
import { createDb } from '@/lib/db/client'
import { dashboardSummary } from './queries'

export const dashboardSummaryFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async () => dashboardSummary(createDb(env.DB)))
