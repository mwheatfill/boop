import { describe, expect, it } from 'vitest'
import { getTargetHealth, type TargetHealthInputs } from './target-health'

const tunnelTarget: TargetHealthInputs = {
  reachability: 'tunnel',
  tunnelState: 'operational',
  lastVerifyOutcome: null,
  runSignal: null,
}

describe('getTargetHealth', () => {
  it('is null for public Targets, whatever the other signals', () => {
    expect(getTargetHealth({ ...tunnelTarget, reachability: 'public' })).toBeNull()
    expect(
      getTargetHealth({
        reachability: 'public',
        tunnelState: 'attention',
        lastVerifyOutcome: 'forbidden',
        runSignal: { outcome: 'failure', httpStatus: 502, failureKind: 'http_5xx' },
      }),
    ).toBeNull()
  })

  it('is tunnel_offline whenever the Tunnel is not operational', () => {
    for (const state of ['provisioning', 'install_pending', 'attention', null] as const) {
      expect(getTargetHealth({ ...tunnelTarget, tunnelState: state })).toBe('tunnel_offline')
    }
  })

  it('is checking when the Tunnel is operational but no signal has arrived', () => {
    expect(getTargetHealth(tunnelTarget)).toBe('checking')
    expect(getTargetHealth({ ...tunnelTarget, lastVerifyOutcome: 'unknown' })).toBe('checking')
  })

  it('maps the synthetic Verify probe when there is no Run signal', () => {
    expect(getTargetHealth({ ...tunnelTarget, lastVerifyOutcome: 'ok' })).toBe('operational')
    expect(getTargetHealth({ ...tunnelTarget, lastVerifyOutcome: 'unauthorized' })).toBe(
      'auth_error',
    )
    expect(getTargetHealth({ ...tunnelTarget, lastVerifyOutcome: 'forbidden' })).toBe('auth_error')
    expect(getTargetHealth({ ...tunnelTarget, lastVerifyOutcome: 'network' })).toBe(
      'origin_unreachable',
    )
  })

  it('reads a 502 through a healthy connector as the origin being unreachable', () => {
    expect(
      getTargetHealth({
        ...tunnelTarget,
        lastVerifyOutcome: 'ok',
        runSignal: { outcome: 'failure', httpStatus: 502, failureKind: 'http_5xx' },
      }),
    ).toBe('origin_unreachable')
  })

  it('reads an Access rejection as an auth error', () => {
    expect(
      getTargetHealth({
        ...tunnelTarget,
        runSignal: { outcome: 'failure', httpStatus: 403, failureKind: 'http_4xx' },
      }),
    ).toBe('auth_error')
    expect(
      getTargetHealth({
        ...tunnelTarget,
        runSignal: {
          outcome: 'failure',
          httpStatus: null,
          failureKind: 'tunnel_credential_missing',
        },
      }),
    ).toBe('auth_error')
  })

  it('lets a real Run override the synthetic probe', () => {
    expect(
      getTargetHealth({
        ...tunnelTarget,
        lastVerifyOutcome: 'forbidden',
        runSignal: { outcome: 'success', httpStatus: 200, failureKind: null },
      }),
    ).toBe('operational')
  })

  it('defers to the probe for failures that say nothing about the tunnel path', () => {
    // An app-level 500 reaches the origin fine; the probe is the tiebreaker.
    expect(
      getTargetHealth({
        ...tunnelTarget,
        lastVerifyOutcome: 'ok',
        runSignal: { outcome: 'failure', httpStatus: 500, failureKind: 'http_5xx' },
      }),
    ).toBe('operational')
    expect(
      getTargetHealth({
        ...tunnelTarget,
        lastVerifyOutcome: null,
        runSignal: { outcome: 'timeout', httpStatus: null, failureKind: 'timeout' },
      }),
    ).toBe('checking')
  })
})
