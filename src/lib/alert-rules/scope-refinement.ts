import { inArray } from 'drizzle-orm'
import type { Database } from '@/lib/db/client'
import { channels } from '@/lib/db/schema'
import type { AlertRuleScope } from '@/shared/schemas/alert-rule'

export type ScopeRefinementResult =
  | { ok: true }
  | { ok: false; reason: 'cross_scope_reference'; detail: string }

interface RuleScopeInput {
  scope: AlertRuleScope
  customerId: string | null
  channelIds: readonly string[]
}

export async function validateChannelScope(
  db: Database,
  rule: RuleScopeInput,
): Promise<ScopeRefinementResult> {
  if (rule.channelIds.length === 0) return { ok: true }
  const rows = await db
    .select({ id: channels.id, scope: channels.scope, customerId: channels.customerId })
    .from(channels)
    .where(inArray(channels.id, [...rule.channelIds]))

  for (const row of rows) {
    if (row.scope === 'workspace') continue
    if (rule.scope === 'workspace') {
      return {
        ok: false,
        reason: 'cross_scope_reference',
        detail: 'Workspace AlertRule may reference workspace Channels only.',
      }
    }
    if (row.customerId !== rule.customerId) {
      return {
        ok: false,
        reason: 'cross_scope_reference',
        detail:
          "A Customer AlertRule may reference workspace Channels or its own Customer's Channels.",
      }
    }
  }
  return { ok: true }
}
