import type { FailureKind, RunOutcome } from '@/shared/schemas/run'
import type { TargetHealth } from '@/shared/schemas/target'
import type { TunnelVerifyOutcome } from '@/shared/schemas/tunnel'
import type { TunnelState } from './health'

// The most recent real Run against the Target, distilled to the signals that
// reveal where the tunnel path breaks: the run outcome plus its representative
// attempt's HTTP status and failure kind.
export interface TargetRunSignal {
  outcome: RunOutcome | null
  httpStatus: number | null
  failureKind: FailureKind | null
}

export interface TargetHealthInputs {
  reachability: 'public' | 'tunnel'
  tunnelState: TunnelState | null
  lastVerifyOutcome: TunnelVerifyOutcome | null
  runSignal: TargetRunSignal | null
}

// Per-Target reachability health (ADR-028). Only tunnel Targets have a path to
// assess; public Targets return null. A healthy connector is never enough on its
// own ("Healthy but unreachable"): real Run outcomes override the synthetic
// Verify probe, and an operational tunnel still reads "origin unreachable" or
// "auth error" when the end-to-end signal says so.
export function getTargetHealth({
  reachability,
  tunnelState,
  lastVerifyOutcome,
  runSignal,
}: TargetHealthInputs): TargetHealth | null {
  if (reachability !== 'tunnel') return null
  if (tunnelState !== 'operational') return 'tunnel_offline'

  const fromRun = runSignal ? healthFromRun(runSignal) : null
  if (fromRun) return fromRun
  return healthFromProbe(lastVerifyOutcome)
}

// A conclusive Run signal, or null when the failure says nothing about the
// tunnel path itself (an app-level error, timeout, or transport error reaching
// the edge) and the probe should decide instead.
function healthFromRun({ outcome, httpStatus, failureKind }: TargetRunSignal): TargetHealth | null {
  if (failureKind === 'tunnel_credential_missing') return 'auth_error'
  if (httpStatus === 401 || httpStatus === 403) return 'auth_error'
  if (httpStatus === 502) return 'origin_unreachable'
  if (outcome === 'success') return 'operational'
  return null
}

function healthFromProbe(outcome: TunnelVerifyOutcome | null): TargetHealth {
  switch (outcome) {
    case 'ok':
      return 'operational'
    case 'unauthorized':
    case 'forbidden':
      return 'auth_error'
    case 'network':
      return 'origin_unreachable'
    default:
      return 'checking'
  }
}
