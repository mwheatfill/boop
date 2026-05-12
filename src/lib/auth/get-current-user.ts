import { createDb } from '@/lib/db/client'
import { logError } from '@/lib/log'
import type { User } from '@/shared/schemas/auth'
import { devBypassUser } from './dev-bypass'
import { AccessJwtError } from './errors'
import { provisionUser } from './provision-user'
import { verifyAccessJwt } from './verify-access-jwt'

export type { User }

export const ACCESS_JWT_HEADER = 'cf-access-jwt-assertion'

export async function getCurrentUser(request: Request, env: Cloudflare.Env): Promise<User | null> {
  const token = request.headers.get(ACCESS_JWT_HEADER)
  if (!token) {
    const bypassed = devBypassUser(env)
    if (bypassed) return bypassed
    if (env.PUBLIC_ENV === 'dev' && !env.DEV_USER_EMAIL) {
      logError('auth.dev_bypass_no_email', {
        hint: 'Set DEV_USER_EMAIL in .dev.vars to enable the local dev bypass.',
      })
    }
    return null
  }
  try {
    const claims = await verifyAccessJwt(token, env)
    if (!claims.email) {
      logError('auth.jwt_missing_email')
      return null
    }
    return await provisionUser(createDb(env.DB), {
      email: claims.email,
      ...(claims.name ? { name: claims.name } : {}),
      ...(claims.picture ? { image: claims.picture } : {}),
    })
  } catch (err) {
    const kind = err instanceof AccessJwtError ? err.kind : 'unknown'
    const message = err instanceof Error ? err.message : String(err)
    logError('auth.verify_failed', { kind, message })
    return null
  }
}
