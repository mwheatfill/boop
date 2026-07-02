import { describe, expect, it } from 'vitest'
import type { DirectoryRecipient } from '@/shared/schemas/directory'
import {
  dedupeEmails,
  emailsToOptions,
  isValidEmail,
  type RecipientOption,
  recipientKey,
  toRecipientOption,
} from './recipient-utils'

describe('isValidEmail', () => {
  it('accepts a plain address and rejects partials', () => {
    expect(isValidEmail('dana@x.com')).toBe(true)
    expect(isValidEmail('  dana@x.com  ')).toBe(true)
    expect(isValidEmail('dana')).toBe(false)
    expect(isValidEmail('dana@x')).toBe(false)
    expect(isValidEmail('')).toBe(false)
  })
})

describe('dedupeEmails', () => {
  it('trims, drops blanks, and removes case-insensitive duplicates keeping first-seen', () => {
    expect(dedupeEmails([' a@x.com ', 'A@X.com', '', 'b@x.com', 'a@x.com'])).toEqual([
      'a@x.com',
      'b@x.com',
    ])
  })
})

describe('emailsToOptions', () => {
  it('resolves known directory picks and falls back to freeform', () => {
    const known = new Map<string, RecipientOption>([
      ['dana@x.com', { mail: 'dana@x.com', displayName: 'Dana Ops', type: 'user' }],
    ])
    expect(emailsToOptions(['Dana@x.com', 'ext@vendor.com'], known)).toEqual([
      { mail: 'dana@x.com', displayName: 'Dana Ops', type: 'user' },
      { mail: 'ext@vendor.com', displayName: 'ext@vendor.com', type: 'freeform' },
    ])
  })
})

describe('toRecipientOption', () => {
  it('projects a DirectoryRecipient to a picker option', () => {
    const recipient: DirectoryRecipient = {
      id: 'g1',
      displayName: 'Ops Team',
      mail: 'ops@x.com',
      type: 'group',
    }
    expect(toRecipientOption(recipient)).toEqual({
      mail: 'ops@x.com',
      displayName: 'Ops Team',
      type: 'group',
    })
  })
})

describe('recipientKey', () => {
  it('normalizes for case-insensitive identity', () => {
    expect(recipientKey('  Dana@X.com ')).toBe('dana@x.com')
  })
})
