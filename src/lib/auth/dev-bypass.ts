import { logWarn } from '@/lib/log'
import type { User } from '@/shared/schemas/auth'

export function devBypassUser(
  env: Pick<Cloudflare.Env, 'PUBLIC_ENV' | 'DEV_USER_EMAIL'>,
): User | null {
  if (env.PUBLIC_ENV !== 'dev') return null
  if (!env.DEV_USER_EMAIL) return null
  logWarn('DEV AUTH BYPASS ACTIVE', { email: env.DEV_USER_EMAIL })
  return {
    id: 'usr_dev0000000000000000000000',
    email: env.DEV_USER_EMAIL,
    role: 'admin',
    name: 'Dev User',
  }
}
