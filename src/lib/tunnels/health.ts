import type { CertStatus, ConnectorStatus } from '@/lib/cloudflare-api/client'

export type TunnelState = 'provisioning' | 'install_pending' | 'operational' | 'attention'

export interface TunnelStateInputs {
  connectorStatus: ConnectorStatus | null
  certStatus: CertStatus | null
}

// The operator-facing tunnel state (ADR-028). Installing the connector is
// independent of the cert, so an un-connected tunnel reads "install the
// connector" even while the cert is still issuing (they act in parallel). The
// brief "provisioning" state is only the window where the connector is up but
// the cert hasn't gone active yet. Origin reachability is a per-Target concern.
export function getTunnelState({ connectorStatus, certStatus }: TunnelStateInputs): TunnelState {
  if (certStatus === 'error') return 'attention'
  if (connectorStatus === 'down' || connectorStatus === 'degraded') return 'attention'
  if (connectorStatus === 'healthy') return certStatus === 'active' ? 'operational' : 'provisioning'
  return 'install_pending'
}
