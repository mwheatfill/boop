import { describe, expect, it } from 'vitest'
import { getTunnelState, type TunnelStateInputs } from './health'

const base: TunnelStateInputs = {
  connectorStatus: 'healthy',
  certStatus: 'active',
}

describe('getTunnelState', () => {
  it('needs attention when the certificate is stuck, whatever the connector', () => {
    expect(getTunnelState({ ...base, certStatus: 'error' })).toBe('attention')
    expect(getTunnelState({ connectorStatus: null, certStatus: 'error' })).toBe('attention')
    expect(getTunnelState({ connectorStatus: 'down', certStatus: 'error' })).toBe('attention')
  })

  it('is provisioning only when the connector is up but the cert is still issuing', () => {
    expect(getTunnelState({ ...base, certStatus: 'pending' })).toBe('provisioning')
    expect(getTunnelState({ ...base, certStatus: null })).toBe('provisioning')
  })

  it('prompts to install the connector while the cert is still issuing (act in parallel)', () => {
    expect(getTunnelState({ connectorStatus: 'inactive', certStatus: 'pending' })).toBe(
      'install_pending',
    )
    expect(getTunnelState({ connectorStatus: null, certStatus: null })).toBe('install_pending')
  })

  it('needs attention when the cert is active but the connector is down or degraded', () => {
    expect(getTunnelState({ ...base, connectorStatus: 'down' })).toBe('attention')
    expect(getTunnelState({ ...base, connectorStatus: 'degraded' })).toBe('attention')
  })

  it('is operational when the cert is active and the connector is healthy', () => {
    expect(getTunnelState({ connectorStatus: 'healthy', certStatus: 'active' })).toBe('operational')
  })

  it('is install_pending when the cert is active but the connector has not connected', () => {
    expect(getTunnelState({ connectorStatus: 'inactive', certStatus: 'active' })).toBe(
      'install_pending',
    )
    expect(getTunnelState({ connectorStatus: null, certStatus: 'active' })).toBe('install_pending')
  })
})
