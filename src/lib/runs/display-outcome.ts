interface Outcomeable {
  status: 'scheduled' | 'running' | 'completed' | 'canceled'
  outcome: 'success' | 'failure' | 'timeout' | null
  skippedReason: string | null
}

export type DisplayOutcome = 'success' | 'failure' | 'timeout' | 'skipped' | 'running' | 'scheduled'

export function computeDisplayOutcome(run: Outcomeable): DisplayOutcome {
  if (run.status === 'completed') {
    if (run.outcome) return run.outcome
    if (run.skippedReason) return 'skipped'
    return 'success'
  }
  if (run.status === 'running') return 'running'
  if (run.status === 'canceled') return 'skipped'
  return 'scheduled'
}
