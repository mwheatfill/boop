import { describe, expect, it } from 'vitest'
import type { User } from '@/shared/schemas/auth'
import { requireAdmin } from './require-admin'

const adminUser: User = { id: 'usr_a', email: 'a@x.com', role: 'admin' }
const operatorUser: User = { id: 'usr_o', email: 'o@x.com', role: 'operator' }

describe('requireAdmin', () => {
  it('returns the user unchanged when the role is admin', () => {
    expect(requireAdmin(adminUser)).toBe(adminUser)
  })

  it('throws a 403 Response when the role is operator', () => {
    let thrown: unknown
    try {
      requireAdmin(operatorUser)
    } catch (err) {
      thrown = err
    }
    expect(thrown).toBeInstanceOf(Response)
    expect((thrown as Response).status).toBe(403)
  })
})
