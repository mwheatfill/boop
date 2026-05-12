import { afterEach, describe, expect, it, vi } from 'vitest'
import * as log from '@/lib/log'
import { devBypassUser } from './dev-bypass'

describe('devBypassUser', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns a user when PUBLIC_ENV is dev and DEV_USER_EMAIL is set', () => {
    const spy = vi.spyOn(log, 'logWarn').mockImplementation(() => {})
    const user = devBypassUser({ PUBLIC_ENV: 'dev', DEV_USER_EMAIL: 'dev@switchthink.com' })
    expect(user).not.toBeNull()
    expect(user?.email).toBe('dev@switchthink.com')
    expect(user?.role).toBe('admin')
    expect(spy).toHaveBeenCalledOnce()
  })

  it('returns null when PUBLIC_ENV is not dev', () => {
    expect(
      devBypassUser({ PUBLIC_ENV: 'production', DEV_USER_EMAIL: 'dev@switchthink.com' }),
    ).toBeNull()
  })

  it('returns null when DEV_USER_EMAIL is unset', () => {
    expect(devBypassUser({ PUBLIC_ENV: 'dev' })).toBeNull()
  })

  it('returns null when PUBLIC_ENV is empty', () => {
    expect(devBypassUser({ PUBLIC_ENV: '' })).toBeNull()
  })
})
