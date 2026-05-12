import { describe, expect, it } from 'vitest'
import { signWebhook } from './sign'
import { verifyWebhook } from './verify'

const NOW_MS = 1_715_000_000_000
const TS = Math.floor(NOW_MS / 1000)
const BODY = '{"hello":"world"}'

describe('verifyWebhook', () => {
  it('returns valid when the signature was produced with an active secret', async () => {
    const header = await signWebhook({ secret: 'one', timestamp: TS, body: BODY })
    expect(await verifyWebhook({ secrets: ['one'], header, body: BODY, now: NOW_MS })).toEqual({
      valid: true,
    })
  })

  it('returns valid when any one of several active secrets matches (rotation overlap)', async () => {
    const header = await signWebhook({ secret: 'new', timestamp: TS, body: BODY })
    const result = await verifyWebhook({
      secrets: ['old', 'new'],
      header,
      body: BODY,
      now: NOW_MS,
    })
    expect(result).toEqual({ valid: true })
  })

  it('rejects missing header as missing_header', async () => {
    expect(await verifyWebhook({ secrets: ['s'], header: null, body: BODY, now: NOW_MS })).toEqual({
      valid: false,
      reason: 'missing_header',
    })
  })

  it('rejects empty header as missing_header', async () => {
    expect(await verifyWebhook({ secrets: ['s'], header: '', body: BODY, now: NOW_MS })).toEqual({
      valid: false,
      reason: 'missing_header',
    })
  })

  it.each([
    ['no t key', 'v1=abcd'],
    ['no v1 key', 't=1715000000'],
    ['non-numeric t', 't=nope,v1=abcd'],
    ['odd-length hex', 't=1715000000,v1=abc'],
    ['non-hex chars', 't=1715000000,v1=zzzz'],
    ['empty part', 't=1715000000,,v1=abcd'],
  ])('rejects %s as bad_format', async (_label, header) => {
    expect(await verifyWebhook({ secrets: ['s'], header, body: BODY, now: NOW_MS })).toEqual({
      valid: false,
      reason: 'bad_format',
    })
  })

  it('rejects timestamp older than 300s as timestamp_skew', async () => {
    const staleTs = TS - 301
    const header = await signWebhook({ secret: 's', timestamp: staleTs, body: BODY })
    expect(await verifyWebhook({ secrets: ['s'], header, body: BODY, now: NOW_MS })).toEqual({
      valid: false,
      reason: 'timestamp_skew',
    })
  })

  it('rejects timestamp newer than 300s as timestamp_skew', async () => {
    const futureTs = TS + 301
    const header = await signWebhook({ secret: 's', timestamp: futureTs, body: BODY })
    expect(await verifyWebhook({ secrets: ['s'], header, body: BODY, now: NOW_MS })).toEqual({
      valid: false,
      reason: 'timestamp_skew',
    })
  })

  it('accepts timestamps at the 300s boundary', async () => {
    const edgeTs = TS - 300
    const header = await signWebhook({ secret: 's', timestamp: edgeTs, body: BODY })
    expect(await verifyWebhook({ secrets: ['s'], header, body: BODY, now: NOW_MS })).toEqual({
      valid: true,
    })
  })

  it('returns no_match when the signature decodes but does not verify', async () => {
    const header = await signWebhook({ secret: 'good', timestamp: TS, body: BODY })
    expect(await verifyWebhook({ secrets: ['wrong'], header, body: BODY, now: NOW_MS })).toEqual({
      valid: false,
      reason: 'no_match',
    })
  })

  it('returns no_match when the body was modified after signing', async () => {
    const header = await signWebhook({ secret: 's', timestamp: TS, body: BODY })
    expect(
      await verifyWebhook({ secrets: ['s'], header, body: `${BODY} tampered`, now: NOW_MS }),
    ).toEqual({ valid: false, reason: 'no_match' })
  })

  it('returns no_match when the secret list is empty', async () => {
    const header = await signWebhook({ secret: 's', timestamp: TS, body: BODY })
    expect(await verifyWebhook({ secrets: [], header, body: BODY, now: NOW_MS })).toEqual({
      valid: false,
      reason: 'no_match',
    })
  })
})
