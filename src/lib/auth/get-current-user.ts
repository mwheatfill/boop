import { env } from 'cloudflare:workers'
import { createDb } from '@/lib/db/client'
import type { User } from '@/shared/types/auth'
import { createAuth, getCurrentUserFromAuth } from './better-auth-provider'

export type { User }

export async function getCurrentUser(request: Request): Promise<User | null> {
  const db = createDb(env.DB)
  const auth = createAuth(db)
  return getCurrentUserFromAuth(request, auth)
}

export function authHandler(request: Request): Response | Promise<Response> {
  const db = createDb(env.DB)
  const auth = createAuth(db)
  return auth.handler(request)
}
