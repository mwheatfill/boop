import { and, asc, eq, sql } from 'drizzle-orm'
import { resolveCustomerId } from '@/lib/customers/resolve'
import type { Database } from '@/lib/db/client'
import { alertRules } from '@/lib/db/schema'
import { NotFoundError } from '@/lib/errors'
import {
  type AlertRule,
  AlertRuleConfigSchema,
  type AlertRuleKind,
} from '@/shared/schemas/alert-rule'

type AlertRuleRow = typeof alertRules.$inferSelect

function parseChannelIds(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((v): v is string => typeof v === 'string')
  } catch {
    return []
  }
}

export function rowToAlertRule(row: AlertRuleRow): AlertRule {
  const config = AlertRuleConfigSchema.parse({
    kind: row.kind,
    ...JSON.parse(row.config || '{}'),
  })
  return {
    id: row.id,
    customerId: row.customerId,
    jobId: row.jobId,
    kind: row.kind as AlertRuleKind,
    name: row.name,
    slug: row.slug,
    config,
    channelIds: parseChannelIds(row.channelIds),
    status: row.status as AlertRule['status'],
    lastFiredAt: row.lastFiredAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export async function listAlertRulesForCustomer(
  db: Database,
  customerSlug: string,
  { includeArchived = false }: { includeArchived?: boolean } = {},
): Promise<AlertRule[]> {
  const customerId = await resolveCustomerId(db, customerSlug)
  const rows = includeArchived
    ? await db
        .select()
        .from(alertRules)
        .where(eq(alertRules.customerId, customerId))
        .orderBy(asc(alertRules.name))
    : await db
        .select()
        .from(alertRules)
        .where(and(eq(alertRules.customerId, customerId), eq(alertRules.status, 'active')))
        .orderBy(asc(alertRules.name))
  return rows.map(rowToAlertRule)
}

export async function getAlertRuleBySlug(
  db: Database,
  customerSlug: string,
  ruleSlug: string,
): Promise<AlertRule> {
  const customerId = await resolveCustomerId(db, customerSlug)
  const row = (
    await db
      .select()
      .from(alertRules)
      .where(and(eq(alertRules.customerId, customerId), eq(alertRules.slug, ruleSlug)))
      .limit(1)
  )[0]
  if (!row) throw new NotFoundError('AlertRule', `${customerSlug}/${ruleSlug}`)
  return rowToAlertRule(row)
}

export async function countCustomerRulesForJob(
  db: Database,
  customerSlug: string,
): Promise<number> {
  const customerId = await resolveCustomerId(db, customerSlug)
  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(alertRules)
    .where(and(eq(alertRules.customerId, customerId), eq(alertRules.status, 'active')))
  return row?.count ?? 0
}
