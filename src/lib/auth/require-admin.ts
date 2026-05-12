import type { User } from '@/shared/schemas/auth'

export function requireAdmin(user: User): User {
  if (user.role !== 'admin') {
    throw new Response('Forbidden', { status: 403 })
  }
  return user
}
