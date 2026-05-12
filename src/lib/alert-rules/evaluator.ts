import { and, desc, eq, sql } from 'drizzle-orm'
import type { Database } from '@/lib/db/client'
import { alertRules, runs } from '@/lib/db/schema'
import { logError } from '@/lib/log'
import {
  type AlertRuleConfig,
  AlertRuleConfigSchema,
  type AlertRuleKind,
} from '@/shared/schemas/alert-rule'
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
  ruleKind: AlertRuleKind
  channelIds: string[]
}

const HISTORY_HARD_CAP = 100
const BASELINE_HISTORY = 2

interface LoadedRule {
  id: string
  slug: string
  name: string
  kind: AlertRuleKind
  config: AlertRuleConfig
  channelIds: string[]
}

function parseChannelIds(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((v): v is string => typeof v === 'string' && v.length > 0)
  } catch {
    return []
  }
}

function parseRuleRow(row: typeof alertRules.$inferSelect): LoadedRule | null {
  try {
    const config = AlertRuleConfigSchema.parse({ kind: row.kind, ...JSON.parse(row.config) })
    const channelIds = parseChannelIds(row.channelIds)
    if (channelIds.length === 0) return null
    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      kind: row.kind as AlertRuleKind,
      config,
      channelIds,
    }
  } catch (err) {
    logError('alert.rule_parse_failed', err, { ruleId: row.id })
    return null
  }
}

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
  }
}

export interface EvaluateRulesInput {
  db: Database
  customerId: string
  jobId: string
  runId: string
}

export async function evaluateRulesForRun({
  db,
  customerId,
  jobId,
  runId,
}: EvaluateRulesInput): Promise<FiringPair[]> {
  const ruleRows = await db
    .select()
    .from(alertRules)
    .where(
      and(
        eq(alertRules.customerId, customerId),
        eq(alertRules.status, 'active'),
        sql`${alertRules.jobId} IS NULL`,
      ),
    )
  const rules = ruleRows.map(parseRuleRow).filter((r): r is LoadedRule => r !== null)
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
        ruleKind: rule.kind,
        channelIds: rule.channelIds,
      })
    }
  }
  return firing
}
