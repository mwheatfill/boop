import { describe, expect, it } from 'vitest'
import { signWebhook } from './sign'

const SECRET = 'whsec_test_abc123'

describe('signWebhook', () => {
  it('returns a t=,v1= header value with lowercase hex', async () => {
    const header = await signWebhook({ secret: SECRET, timestamp: 1715000000, body: '{"x":1}' })
    expect(header).toMatch(/^t=1715000000,v1=[0-9a-f]{64}$/)
  })

  it('is deterministic for the same secret, timestamp, and body', async () => {
    const input = { secret: SECRET, timestamp: 1715000000, body: 'hello' }
    expect(await signWebhook(input)).toBe(await signWebhook(input))
  })

  it('differs when the body changes', async () => {
    const a = await signWebhook({ secret: SECRET, timestamp: 1715000000, body: 'a' })
    const b = await signWebhook({ secret: SECRET, timestamp: 1715000000, body: 'b' })
    expect(a).not.toBe(b)
  })

  it('differs when the timestamp changes', async () => {
    const a = await signWebhook({ secret: SECRET, timestamp: 1715000000, body: 'x' })
    const b = await signWebhook({ secret: SECRET, timestamp: 1715000001, body: 'x' })
    expect(a).not.toBe(b)
  })

  it('signs UTF-8 bodies without corruption', async () => {
    const header = await signWebhook({ secret: SECRET, timestamp: 1, body: 'café — π' })
    expect(header).toMatch(/^t=1,v1=[0-9a-f]{64}$/)
  })

  it('signs an empty body', async () => {
    const header = await signWebhook({ secret: SECRET, timestamp: 1, body: '' })
    expect(header).toMatch(/^t=1,v1=[0-9a-f]{64}$/)
  })
})
