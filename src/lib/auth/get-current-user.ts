import { env } from 'cloudflare:workers'
import { createDb } from '@/lib/db/client'
import type { User } from '@/shared/types/auth'
import { type AuthInstance, createAuth, getCurrentUserFromAuth } from './better-auth-provider'

export type { User }

function getAuth(): AuthInstance {
  return createAuth(createDb(env.DB))
}

export async function getCurrentUser(request: Request): Promise<User | null> {
  return getCurrentUserFromAuth(request, getAuth())
}

export function authHandler(request: Request): Response | Promise<Response> {
  return getAuth().handler(request)
}
