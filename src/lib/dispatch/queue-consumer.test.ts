import { describe, expect, it } from 'vitest'
import {
  ClaimFailedError,
  DispatchError,
  JobNotDispatchableError,
  RenderError,
  TargetHttpError,
  TargetNetworkError,
  TargetTimeoutError,
} from './errors'
import { classifyError } from './queue-consumer'

describe('classifyError', () => {
  it('acks ClaimFailedError', () => {
    expect(classifyError(new ClaimFailedError('job_1')).decision).toBe('ack')
  })

  it('acks JobNotDispatchableError', () => {
    expect(classifyError(new JobNotDispatchableError('job_1', 'paused')).decision).toBe('ack')
  })

  it('acks RenderError (permanent)', () => {
    expect(classifyError(new RenderError(new Error('boom'))).decision).toBe('ack')
  })

  it('acks 4xx TargetHttpError (permanent)', () => {
    expect(classifyError(new TargetHttpError(404)).decision).toBe('ack')
    expect(classifyError(new TargetHttpError(499)).decision).toBe('ack')
  })

  it('retries 5xx TargetHttpError', () => {
    expect(classifyError(new TargetHttpError(503)).decision).toBe('retry')
    expect(classifyError(new TargetHttpError(599)).decision).toBe('retry')
  })

  it('retries TargetTimeoutError and TargetNetworkError', () => {
    expect(classifyError(new TargetTimeoutError()).decision).toBe('retry')
    expect(classifyError(new TargetNetworkError(new Error('ECONNRESET'))).decision).toBe('retry')
  })

  it('rethrows generic DispatchError and unknown errors', () => {
    expect(classifyError(new DispatchError('weird')).decision).toBe('rethrow')
    expect(classifyError(new TypeError('unexpected')).decision).toBe('rethrow')
    expect(classifyError(null).decision).toBe('rethrow')
  })
})
