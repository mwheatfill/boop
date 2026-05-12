export type TerminalOutcome = 'success' | 'failure' | 'timeout'

export interface PredicateRun {
  outcome: TerminalOutcome | null
  startedAt: Date | null
  completedAt: Date | null
}

export function relevantRunHistory<T extends PredicateRun>(history: readonly T[]): T[] {
  return history.filter((r) => r.outcome !== null)
}

export function firstFailure(history: readonly PredicateRun[]): boolean {
  const filtered = relevantRunHistory(history)
  const current = filtered[0]
  const prior = filtered[1]
  if (!current || !prior) return false
  if (current.outcome !== 'failure') return false
  return prior.outcome === 'success'
}

export function consecutiveFailures(history: readonly PredicateRun[], count: number): boolean {
  if (count < 1) return false
  const filtered = relevantRunHistory(history)
  if (filtered.length < count) return false
  return filtered.slice(0, count).every((r) => r.outcome === 'failure' || r.outcome === 'timeout')
}

export function recovery(history: readonly PredicateRun[]): boolean {
  const filtered = relevantRunHistory(history)
  const current = filtered[0]
  const prior = filtered[1]
  if (!current || !prior) return false
  if (current.outcome !== 'success') return false
  return prior.outcome === 'failure' || prior.outcome === 'timeout'
}

export function slowRun(run: PredicateRun, thresholdMs: number): boolean {
  if (!run.startedAt || !run.completedAt) return false
  const duration = run.completedAt.getTime() - run.startedAt.getTime()
  return duration > thresholdMs
}
