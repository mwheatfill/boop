import { describe, expect, it } from 'vitest'
import type { AdapterResult } from '@/lib/channel-adapters/types'
import { decideDisposition, retryDelaySeconds } from './disposition'

const RETRYABLE: AdapterResult = { ok: false, retryable: true, reason: 'HTTP 503' }
const TERMINAL: AdapterResult = { ok: false, retryable: false, reason: 'HTTP 400' }
const OK: AdapterResult = { ok: true }

describe('decideDisposition', () => {
  it('acks a successful delivery', () => {
    expect(decideDisposition(OK, 1)).toEqual({ ack: true })
  })

  it('retries a first-attempt retryable failure with exponential backoff', () => {
    expect(decideDisposition(RETRYABLE, 1)).toEqual({ retry: true, delaySeconds: 120 })
  })

  it('backs off exponentially across attempts under the gate', () => {
    expect(decideDisposition(RETRYABLE, 2)).toEqual({ retry: true, delaySeconds: 240 })
    expect(decideDisposition(RETRYABLE, 3)).toEqual({ retry: true, delaySeconds: 480 })
    expect(decideDisposition(RETRYABLE, 4)).toEqual({ retry: true, delaySeconds: 960 })
  })

  it('acks (gives up) once MAX_DELIVERY_ATTEMPTS is reached', () => {
    expect(decideDisposition(RETRYABLE, 4)).toEqual({ retry: true, delaySeconds: 960 })
    expect(decideDisposition(RETRYABLE, 5)).toEqual({ ack: true })
    expect(decideDisposition(RETRYABLE, 6)).toEqual({ ack: true })
  })

  it('acks a non-retryable failure without retrying', () => {
    expect(decideDisposition(TERMINAL, 1)).toEqual({ ack: true })
  })
})

describe('retryDelaySeconds', () => {
  it('doubles the base delay per attempt', () => {
    expect(retryDelaySeconds(1)).toBe(120)
    expect(retryDelaySeconds(2)).toBe(240)
    expect(retryDelaySeconds(3)).toBe(480)
  })

  it('caps the exponent at 2^6', () => {
    const capped = 2 ** 6 * 60
    expect(retryDelaySeconds(6)).toBe(capped)
    expect(retryDelaySeconds(7)).toBe(capped)
    expect(retryDelaySeconds(100)).toBe(capped)
  })
})
