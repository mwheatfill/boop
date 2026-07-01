import { and, desc, eq, or } from 'drizzle-orm'
import type { Database } from '@/lib/db/client'
import { alertRules, runs } from '@/lib/db/schema'
import type { AlertRuleKind } from '@/shared/schemas/alert-rule'
import { decodeAlertRuleRow, type LoadedRule } from './decode'
import {
  consecutiveFailures,
  firstFailure,
  type PredicateRun,
  recovery,
  slowRun,
} from './predicates'

export interface FiringPair {
  ruleId: string
  ruleSlug: string
  ruleName: string
  ruleKind: Exclude<AlertRuleKind, 'missed_schedule'>
  channelIds: string[]
}

const HISTORY_HARD_CAP = 100
const BASELINE_HISTORY = 2

function historyDepthFor(rules: readonly LoadedRule[]): number {
  let depth = BASELINE_HISTORY
  for (const rule of rules) {
    if (rule.config.kind === 'consecutive_failures') {
      depth = Math.max(depth, rule.config.count)
    }
  }
  return Math.min(depth, HISTORY_HARD_CAP)
}

function evaluateOne(
  rule: LoadedRule,
  current: PredicateRun,
  history: readonly PredicateRun[],
): boolean {
  switch (rule.config.kind) {
    case 'first_failure':
      return firstFailure(history)
    case 'consecutive_failures':
      return consecutiveFailures(history, rule.config.count)
    case 'recovery':
      return recovery(history)
    case 'slow_run':
      return slowRun(current, rule.config.threshold_ms)
    case 'missed_schedule':
      return false
  }
}

export interface EvaluateRulesInput {
  db: Database
  workspaceId: string
  jobId: string
  runId: string
}

export async function evaluateRulesForRun({
  db,
  workspaceId,
  jobId,
  runId,
}: EvaluateRulesInput): Promise<FiringPair[]> {
  const ruleRows = await db
    .select()
    .from(alertRules)
    .where(
      and(
        eq(alertRules.status, 'active'),
        or(
          and(eq(alertRules.scope, 'workspace'), eq(alertRules.workspaceId, workspaceId)),
          and(eq(alertRules.scope, 'job'), eq(alertRules.jobId, jobId)),
        ),
      ),
    )
  const rules = ruleRows.flatMap((row) => {
    const rule = decodeAlertRuleRow(row)
    return rule ? [rule] : []
  })
  if (rules.length === 0) return []

  const depth = historyDepthFor(rules)
  const historyRows = await db
    .select({
      id: runs.id,
      outcome: runs.outcome,
      startedAt: runs.startedAt,
      completedAt: runs.completedAt,
    })
    .from(runs)
    .where(eq(runs.jobId, jobId))
    .orderBy(desc(runs.startedAt))
    .limit(depth + 1)

  const current = historyRows.find((r) => r.id === runId)
  if (!current) return []

  const firing: FiringPair[] = []
  for (const rule of rules) {
    if (evaluateOne(rule, current, historyRows)) {
      firing.push({
        ruleId: rule.id,
        ruleSlug: rule.slug,
        ruleName: rule.name,
        ruleKind: rule.kind as Exclude<AlertRuleKind, 'missed_schedule'>,
        channelIds: rule.channelIds,
      })
    }
  }
  return firing
}
