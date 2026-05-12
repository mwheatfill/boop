import type { User } from '@/shared/schemas/auth'

export function isAdmin(user: Pick<User, 'role'>): boolean {
  return user.role === 'admin'
}
