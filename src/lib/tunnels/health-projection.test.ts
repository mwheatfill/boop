import { describe, expect, it } from 'vitest'
import {
  projectTargetHealth,
  projectTunnel,
  type TargetHealthRow,
  type TunnelInfo,
} from './health-projection'
import type { TargetRunSignal } from './target-health'

describe('projectTunnel', () => {
  it('derives operational for a healthy connector with an active cert', () => {
    expect(
      projectTunnel({ connectorStatus: 'healthy', certStatus: 'active', lastVerifyOutcome: null }),
    ).toEqual({
      state: 'operational',
      lastVerifyOutcome: null,
    })
  })

  it('derives provisioning when the connector is up but the cert is still issuing', () => {
    expect(
      projectTunnel({ connectorStatus: 'healthy', certStatus: null, lastVerifyOutcome: 'ok' })
        .state,
    ).toBe('provisioning')
  })

  it('derives install_pending when nothing has connected yet', () => {
    expect(
      projectTunnel({ connectorStatus: null, certStatus: null, lastVerifyOutcome: null }).state,
    ).toBe('install_pending')
  })

  it('derives attention for a down connector and passes the probe outcome through', () => {
    expect(
      projectTunnel({
        connectorStatus: 'down',
        certStatus: 'active',
        lastVerifyOutcome: 'network',
      }),
    ).toEqual({ state: 'attention', lastVerifyOutcome: 'network' })
  })

  it('narrows an unexpected free-text cert value to a non-active cert (provisioning)', () => {
    expect(
      projectTunnel({ connectorStatus: 'healthy', certStatus: 'issuing', lastVerifyOutcome: null })
        .state,
    ).toBe('provisioning')
  })
})

const operationalTunnel: TunnelInfo = { state: 'operational', lastVerifyOutcome: null }

function tunnelInfoMap(entries: Record<string, TunnelInfo>): Map<string, TunnelInfo> {
  return new Map(Object.entries(entries))
}

function runSignalMap(entries: Record<string, TargetRunSignal>): Map<string, TargetRunSignal> {
  return new Map(Object.entries(entries))
}

describe('projectTargetHealth', () => {
  it('leaves public Targets without a health, whatever their tunnel column', () => {
    const rows: TargetHealthRow[] = [{ id: 't1', reachability: 'public', tunnelId: null }]
    const health = projectTargetHealth(rows, { tunnelInfo: new Map(), runSignals: new Map() })
    expect(health.get('t1')).toBeNull()
  })

  it('reports checking for an operational tunnel Target with no signal yet', () => {
    const rows: TargetHealthRow[] = [{ id: 't1', reachability: 'tunnel', tunnelId: 'tnl_1' }]
    const health = projectTargetHealth(rows, {
      tunnelInfo: tunnelInfoMap({ tnl_1: operationalTunnel }),
      runSignals: new Map(),
    })
    expect(health.get('t1')).toBe('checking')
  })

  it('reports tunnel_offline when the tunnel is missing or not operational', () => {
    const rows: TargetHealthRow[] = [
      { id: 'missing', reachability: 'tunnel', tunnelId: 'tnl_gone' },
      { id: 'down', reachability: 'tunnel', tunnelId: 'tnl_2' },
    ]
    const health = projectTargetHealth(rows, {
      tunnelInfo: tunnelInfoMap({ tnl_2: { state: 'attention', lastVerifyOutcome: null } }),
      runSignals: new Map(),
    })
    expect(health.get('missing')).toBe('tunnel_offline')
    expect(health.get('down')).toBe('tunnel_offline')
  })

  it('lets a real Run 502 override an ok probe (run overrides probe precedence)', () => {
    const rows: TargetHealthRow[] = [{ id: 't1', reachability: 'tunnel', tunnelId: 'tnl_1' }]
    const health = projectTargetHealth(rows, {
      tunnelInfo: tunnelInfoMap({ tnl_1: { state: 'operational', lastVerifyOutcome: 'ok' } }),
      runSignals: runSignalMap({
        t1: { outcome: 'failure', httpStatus: 502, failureKind: 'http_5xx' },
      }),
    })
    expect(health.get('t1')).toBe('origin_unreachable')
  })

  it('lets a successful Run override a forbidden probe', () => {
    const rows: TargetHealthRow[] = [{ id: 't1', reachability: 'tunnel', tunnelId: 'tnl_1' }]
    const health = projectTargetHealth(rows, {
      tunnelInfo: tunnelInfoMap({
        tnl_1: { state: 'operational', lastVerifyOutcome: 'forbidden' },
      }),
      runSignals: runSignalMap({ t1: { outcome: 'success', httpStatus: 200, failureKind: null } }),
    })
    expect(health.get('t1')).toBe('operational')
  })

  it('projects each row in a mixed batch independently', () => {
    const rows: TargetHealthRow[] = [
      { id: 'pub', reachability: 'public', tunnelId: null },
      { id: 'ok', reachability: 'tunnel', tunnelId: 'tnl_1' },
      { id: 'auth', reachability: 'tunnel', tunnelId: 'tnl_1' },
    ]
    const health = projectTargetHealth(rows, {
      tunnelInfo: tunnelInfoMap({ tnl_1: { state: 'operational', lastVerifyOutcome: 'ok' } }),
      runSignals: runSignalMap({
        auth: { outcome: 'failure', httpStatus: 403, failureKind: 'http_4xx' },
      }),
    })
    expect(health.get('pub')).toBeNull()
    expect(health.get('ok')).toBe('operational')
    expect(health.get('auth')).toBe('auth_error')
  })
})
