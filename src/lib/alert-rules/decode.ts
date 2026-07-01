import type { alertRules } from '@/lib/db/schema'
import { logError } from '@/lib/log'
import {
  type AlertRuleConfig,
  AlertRuleConfigSchema,
  type AlertRuleKind,
} from '@/shared/schemas/alert-rule'

export type AlertRuleRow = typeof alertRules.$inferSelect

// A rule row decoded for evaluation: the config union re-hydrated and the
// channel fan-out targets resolved. The superset that every operational reader
// (evaluator, missed-schedule) projects the fields it needs from.
export interface LoadedRule {
  id: string
  slug: string
  name: string
  kind: AlertRuleKind
  config: AlertRuleConfig
  channelIds: string[]
}

// The channelIds column is a JSON string array; a malformed value decodes to the
// empty set rather than throwing, so one bad row can't sink a whole read.
export function parseChannelIdsColumn(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((v): v is string => typeof v === 'string')
  } catch {
    return []
  }
}

// The config column omits `kind` (it lives in its own column so rows are
// queryable by kind); re-inject it before validating against the discriminated
// union. Throws on malformed JSON or a config that fails the schema.
export function decodeRuleConfig(row: AlertRuleRow): AlertRuleConfig {
  return AlertRuleConfigSchema.parse({ kind: row.kind, ...JSON.parse(row.config || '{}') })
}

// Decode a rule row for evaluation. Owns the operational policy shared by the
// evaluator and the missed-schedule sweep: a rule with no channels is a no-op
// (skip), and a row that fails to decode is logged and skipped so one malformed
// rule can't sink the batch.
export function decodeAlertRuleRow(row: AlertRuleRow): LoadedRule | null {
  try {
    const config = decodeRuleConfig(row)
    const channelIds = parseChannelIdsColumn(row.channelIds)
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
