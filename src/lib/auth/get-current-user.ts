import type { User } from '@/shared/types/auth'

export type { User }

// Auth provider stub. Install an auth recipe (auth/better-auth or
// auth/cloudflare-access) to wire actual session resolution. Until then,
// every caller receives null and any auth-gated route resolves as
// unauthenticated.
export async function getCurrentUser(_request: Request): Promise<User | null> {
  return null
}
