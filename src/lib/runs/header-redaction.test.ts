import { describe, expect, it } from 'vitest'
import { redactHeaders } from './header-redaction'

describe('redactHeaders', () => {
  it('redacts the default sensitive keys', () => {
    const result = redactHeaders({
      Authorization: 'Bearer abc',
      Cookie: 'session=xyz',
      'Set-Cookie': 'a=1; Path=/',
      'X-Api-Key': 'k',
      'Proxy-Authorization': 'Basic ...',
      'X-Request-Id': 'r-1',
    })
    expect(result.Authorization).toBe('[redacted]')
    expect(result.Cookie).toBe('[redacted]')
    expect(result['Set-Cookie']).toBe('[redacted]')
    expect(result['X-Api-Key']).toBe('[redacted]')
    expect(result['Proxy-Authorization']).toBe('[redacted]')
    expect(result['X-Request-Id']).toBe('r-1')
  })

  it('matches keys case-insensitively', () => {
    const result = redactHeaders({
      AUTHORIZATION: 'Bearer abc',
      cookie: 'session=xyz',
      'x-API-key': 'k',
    })
    expect(result.AUTHORIZATION).toBe('[redacted]')
    expect(result.cookie).toBe('[redacted]')
    expect(result['x-API-key']).toBe('[redacted]')
  })

  it('does not mutate the input object', () => {
    const input = { Authorization: 'Bearer abc', 'X-Other': 'ok' }
    const snapshot = { ...input }
    redactHeaders(input)
    expect(input).toEqual(snapshot)
  })

  it('supports additionalKeys additively', () => {
    const result = redactHeaders(
      { Authorization: 'Bearer abc', 'X-Custom-Secret': 's' },
      { additionalKeys: ['x-custom-secret'] },
    )
    expect(result.Authorization).toBe('[redacted]')
    expect(result['X-Custom-Secret']).toBe('[redacted]')
  })

  it('returns an empty object for empty input', () => {
    expect(redactHeaders({})).toEqual({})
  })

  it('stringifies non-string values before redacting', () => {
    const result = redactHeaders({
      'X-Count': 42,
      Authorization: 99,
    })
    expect(result['X-Count']).toBe('42')
    expect(result.Authorization).toBe('[redacted]')
  })
})
