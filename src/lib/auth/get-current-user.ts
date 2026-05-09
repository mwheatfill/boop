import type { User } from '@/shared/types/auth'

export type { User }

// Until an auth recipe is installed, this returns null and any auth-gated
// route resolves as unauthenticated. Install auth/better-auth (default) or
// auth/cloudflare-access to wire actual session resolution.
export async function getCurrentUser(_request: Request): Promise<User | null> {
  return null
}
