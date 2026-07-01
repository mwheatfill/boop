import type { CertStatus, ConnectorStatus } from '@/lib/cloudflare-api/client'
import type { TargetHealth } from '@/shared/schemas/target'
import type { TunnelVerifyOutcome } from '@/shared/schemas/tunnel'
import { getTunnelState, type TunnelState } from './health'
import { getTargetHealth, type TargetRunSignal } from './target-health'

// The tunnel columns the health derivation reads. Both query modules select at
// least these; any wider row satisfies it. certStatus is a free-text column, so
// it is narrowed to CertStatus here rather than at each call site.
export interface TunnelHealthRow {
  connectorStatus: ConnectorStatus | null
  certStatus: string | null
  lastVerifyOutcome: TunnelVerifyOutcome | null
}

// The derived per-tunnel signals a Target's health depends on: the operator-facing
// state plus the last synthetic-probe outcome.
export interface TunnelInfo {
  state: TunnelState
  lastVerifyOutcome: TunnelVerifyOutcome | null
}

// One place that maps a tunnel row into its derived health inputs and state, so
// the row -> getTunnelState wiring lives in a single read model instead of being
// re-implemented in the tunnels and targets query modules.
export function projectTunnel(row: TunnelHealthRow): TunnelInfo {
  return {
    state: getTunnelState({
      connectorStatus: row.connectorStatus ?? null,
      certStatus: (row.certStatus ?? null) as CertStatus | null,
    }),
    lastVerifyOutcome: row.lastVerifyOutcome ?? null,
  }
}

// The Target columns that decide reachability health: which tunnel (if any) the
// Target rides and whether it is a tunnel Target at all.
export interface TargetHealthRow {
  id: string
  reachability: 'public' | 'tunnel'
  tunnelId: string | null
}

export interface TargetHealthSignals {
  tunnelInfo: Map<string, TunnelInfo>
  runSignals: Map<string, TargetRunSignal>
}

// Assembles each Target's getTargetHealth inputs from its row plus the loaded
// tunnel and run signals, then applies the pure derivation. Owning this wiring in
// the read model makes the precedence (a real Run overrides the synthetic probe)
// testable from rows + signals directly, not only through the full D1 query path.
export function projectTargetHealth(
  rows: TargetHealthRow[],
  signals: TargetHealthSignals,
): Map<string, TargetHealth | null> {
  const health = new Map<string, TargetHealth | null>()
  for (const row of rows) {
    const info = row.tunnelId ? signals.tunnelInfo.get(row.tunnelId) : undefined
    health.set(
      row.id,
      getTargetHealth({
        reachability: row.reachability,
        tunnelState: info?.state ?? null,
        lastVerifyOutcome: info?.lastVerifyOutcome ?? null,
        runSignal: signals.runSignals.get(row.id) ?? null,
      }),
    )
  }
  return health
}
