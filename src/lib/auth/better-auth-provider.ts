import { env } from 'cloudflare:workers'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import type { Database } from '@/lib/db/client'
import type { User } from '@/shared/types/auth'

export type AuthInstance = ReturnType<typeof createAuth>

export function createAuth(db: Database) {
  if (!env.BETTER_AUTH_SECRET) {
    throw new Error('BETTER_AUTH_SECRET is not set; auth cannot start')
  }

  type SocialProvider = { clientId: string; clientSecret: string; tenantId?: string }
  const socialProviders: Record<string, SocialProvider> = {}
  if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
    socialProviders.google = {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    }
  }
  if (env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET) {
    socialProviders.github = {
      clientId: env.GITHUB_CLIENT_ID,
      clientSecret: env.GITHUB_CLIENT_SECRET,
    }
  }
  if (env.APPLE_CLIENT_ID && env.APPLE_CLIENT_SECRET) {
    socialProviders.apple = {
      clientId: env.APPLE_CLIENT_ID,
      clientSecret: env.APPLE_CLIENT_SECRET,
    }
  }
  if (env.MICROSOFT_CLIENT_ID && env.MICROSOFT_CLIENT_SECRET) {
    socialProviders.microsoft = {
      clientId: env.MICROSOFT_CLIENT_ID,
      clientSecret: env.MICROSOFT_CLIENT_SECRET,
      ...(env.MICROSOFT_TENANT_ID && { tenantId: env.MICROSOFT_TENANT_ID }),
    }
  }

  return betterAuth({
    database: drizzleAdapter(db, { provider: 'sqlite' }),
    secret: env.BETTER_AUTH_SECRET,
    ...(env.BETTER_AUTH_URL && { baseURL: env.BETTER_AUTH_URL }),
    emailAndPassword: { enabled: true },
    socialProviders,
  })
}

export async function getCurrentUserFromAuth(
  request: Request,
  auth: AuthInstance,
): Promise<User | null> {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session?.user) return null

  return {
    id: session.user.id,
    email: session.user.email,
    ...(session.user.name && { name: session.user.name }),
    ...(session.user.image && { image: session.user.image }),
    groups: [],
  }
}
