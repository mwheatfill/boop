import { describe, expect, it } from 'vitest'
import {
  consecutiveFailures,
  firstFailure,
  type PredicateRun,
  recovery,
  relevantRunHistory,
  slowRun,
} from './predicates'

function run(outcome: PredicateRun['outcome'], durationMs = 1000): PredicateRun {
  return { outcome, startedAt: new Date(0), completedAt: new Date(durationMs) }
}

const SUCCESS = run('success')
const FAILURE = run('failure')
const TIMEOUT = run('timeout')
const SKIPPED = run(null)

describe('relevantRunHistory', () => {
  it('filters out skipped runs', () => {
    expect(relevantRunHistory([FAILURE, SKIPPED, SUCCESS])).toEqual([FAILURE, SUCCESS])
  })
})

describe('firstFailure', () => {
  it('fires on failure after success', () => {
    expect(firstFailure([FAILURE, SUCCESS])).toBe(true)
  })
  it('does not fire on consecutive failures', () => {
    expect(firstFailure([FAILURE, FAILURE])).toBe(false)
  })
  it('does not fire without a prior terminal run', () => {
    expect(firstFailure([FAILURE])).toBe(false)
  })
  it('does not fire on success', () => {
    expect(firstFailure([SUCCESS, FAILURE])).toBe(false)
  })
  it('skipped runs do not break the lookback', () => {
    expect(firstFailure([FAILURE, SKIPPED, SUCCESS])).toBe(true)
  })
})

describe('consecutiveFailures', () => {
  it('fires when last N runs are all non-success', () => {
    expect(consecutiveFailures([FAILURE, FAILURE, FAILURE], 3)).toBe(true)
  })
  it('does not fire when one of last N is success', () => {
    expect(consecutiveFailures([FAILURE, SUCCESS, FAILURE], 3)).toBe(false)
  })
  it('does not fire when only N-1 history is available', () => {
    expect(consecutiveFailures([FAILURE, FAILURE], 3)).toBe(false)
  })
  it('treats timeout as a failure for streak purposes', () => {
    expect(consecutiveFailures([TIMEOUT, FAILURE, TIMEOUT], 3)).toBe(true)
  })
  it('skipped runs do not break the streak', () => {
    expect(consecutiveFailures([FAILURE, SKIPPED, FAILURE, SKIPPED, FAILURE], 3)).toBe(true)
  })
})

describe('recovery', () => {
  it('fires on success after failure', () => {
    expect(recovery([SUCCESS, FAILURE])).toBe(true)
  })
  it('fires on success after timeout', () => {
    expect(recovery([SUCCESS, TIMEOUT])).toBe(true)
  })
  it('does not fire on success after success', () => {
    expect(recovery([SUCCESS, SUCCESS])).toBe(false)
  })
  it('does not fire without a prior terminal run', () => {
    expect(recovery([SUCCESS])).toBe(false)
  })
})

describe('slowRun', () => {
  it('fires when duration > threshold', () => {
    expect(slowRun(run('success', 30_001), 30_000)).toBe(true)
  })
  it('does not fire at exactly threshold', () => {
    expect(slowRun(run('success', 30_000), 30_000)).toBe(false)
  })
  it('fires regardless of outcome', () => {
    expect(slowRun(run('failure', 50_000), 30_000)).toBe(true)
  })
  it('does not fire when start or completion is null', () => {
    expect(slowRun({ outcome: 'success', startedAt: null, completedAt: new Date() }, 1)).toBe(false)
  })
})
