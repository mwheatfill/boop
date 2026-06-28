import { describe, expect, it } from 'vitest'
import { getTunnelHealth, type TunnelHealthInputs } from './health'

const base: TunnelHealthInputs = {
  connectorStatus: 'healthy',
  lastVerifyOutcome: null,
  recentRunTotal: 0,
  recentRunFailures: 0,
}

describe('getTunnelHealth', () => {
  it('reports not_connected when the connector has never connected', () => {
    expect(getTunnelHealth({ ...base, connectorStatus: null })).toBe('not_connected')
    expect(getTunnelHealth({ ...base, connectorStatus: 'inactive' })).toBe('not_connected')
  })

  it('mirrors a down or degraded connector', () => {
    expect(getTunnelHealth({ ...base, connectorStatus: 'down' })).toBe('down')
    expect(getTunnelHealth({ ...base, connectorStatus: 'degraded' })).toBe('degraded')
  })

  it('is operational when the connector is healthy and recent Runs all succeed', () => {
    expect(getTunnelHealth({ ...base, recentRunTotal: 5, recentRunFailures: 0 })).toBe(
      'operational',
    )
  })

  it('is degraded when the connector is healthy but every recent Run fails (origin unreachable)', () => {
    expect(getTunnelHealth({ ...base, recentRunTotal: 4, recentRunFailures: 4 })).toBe('degraded')
  })

  it('lets succeeding Runs override a stale failed verify', () => {
    expect(
      getTunnelHealth({
        ...base,
        lastVerifyOutcome: 'network',
        recentRunTotal: 3,
        recentRunFailures: 0,
      }),
    ).toBe('operational')
  })

  it('is operational on a healthy connector with a passing verify and no Runs', () => {
    expect(getTunnelHealth({ ...base, lastVerifyOutcome: 'ok' })).toBe('operational')
  })

  it('is degraded on a healthy connector with a failing verify', () => {
    expect(getTunnelHealth({ ...base, lastVerifyOutcome: 'unauthorized' })).toBe('degraded')
    expect(getTunnelHealth({ ...base, lastVerifyOutcome: 'forbidden' })).toBe('degraded')
  })

  it('is unverified on a healthy connector with no verify and no Runs', () => {
    expect(getTunnelHealth(base)).toBe('unverified')
  })

  it('is degraded on a healthy connector with any recent Run failures', () => {
    expect(getTunnelHealth({ ...base, recentRunTotal: 4, recentRunFailures: 2 })).toBe('degraded')
  })
})
