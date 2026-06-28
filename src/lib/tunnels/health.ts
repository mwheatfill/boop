import type { ConnectorStatus } from '@/lib/cloudflare-api/client'

export type TunnelHealth = 'operational' | 'degraded' | 'down' | 'not_connected' | 'unverified'

export type VerifyOutcome = 'ok' | 'unauthorized' | 'forbidden' | 'network' | 'unknown'

export interface TunnelHealthInputs {
  connectorStatus: ConnectorStatus | null
  lastVerifyOutcome: VerifyOutcome | null
  // Terminal Runs against this tunnel's Targets in the recent window.
  recentRunTotal: number
  recentRunFailures: number
}

// The rolled-up status, fused from three signals (ADR-028). The connector layer
// is the floor: a tunnel that is not connected or down cannot be operational.
// When the connector is healthy, the origin layer decides, because a healthy
// connector says nothing about whether cloudflared can reach the origin: real
// Run outcomes are the strongest signal, then the explicit verify, else unknown.
export function getTunnelHealth(inputs: TunnelHealthInputs): TunnelHealth {
  const { connectorStatus, lastVerifyOutcome, recentRunTotal, recentRunFailures } = inputs

  if (connectorStatus === null || connectorStatus === 'inactive') return 'not_connected'
  if (connectorStatus === 'down') return 'down'
  if (connectorStatus === 'degraded') return 'degraded'

  // connectorStatus === 'healthy': decide on the origin-reachability layer.
  // Recent Runs are decisive when present: any failure means the origin is not
  // reliably reachable despite a healthy connector. Otherwise fall back to the
  // explicit verify, then to unverified.
  if (recentRunTotal > 0) {
    return recentRunFailures === 0 ? 'operational' : 'degraded'
  }
  if (lastVerifyOutcome === 'ok') return 'operational'
  if (lastVerifyOutcome !== null) return 'degraded'
  return 'unverified'
}
