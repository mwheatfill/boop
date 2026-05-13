import { and, asc, eq, isNull, sql } from 'drizzle-orm'
import { resolveCustomerId } from '@/lib/customers/resolve'
import type { Database } from '@/lib/db/client'
import { alertRules } from '@/lib/db/schema'
import { NotFoundError } from '@/lib/errors'
import {
  type AlertRule,
  AlertRuleConfigSchema,
  type AlertRuleKind,
  type AlertRuleScope,
} from '@/shared/schemas/alert-rule'

type AlertRuleRow = typeof alertRules.$inferSelect

export function parseChannelIdsColumn(raw: string): string[] {
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
    scope: row.scope as AlertRuleScope,
    customerId: row.customerId,
    jobId: row.jobId,
    kind: row.kind as AlertRuleKind,
    name: row.name,
    slug: row.slug,
    config,
    channelIds: parseChannelIdsColumn(row.channelIds),
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
  const conditions = [eq(alertRules.scope, 'customer'), eq(alertRules.customerId, customerId)]
  if (!includeArchived) conditions.push(eq(alertRules.status, 'active'))
  const rows = await db
    .select()
    .from(alertRules)
    .where(and(...conditions))
    .orderBy(asc(alertRules.name))
  return rows.map(rowToAlertRule)
}

export async function listWorkspaceAlertRules(
  db: Database,
  { includeArchived = false }: { includeArchived?: boolean } = {},
): Promise<AlertRule[]> {
  const conditions = [eq(alertRules.scope, 'workspace')]
  if (!includeArchived) conditions.push(eq(alertRules.status, 'active'))
  const rows = await db
    .select()
    .from(alertRules)
    .where(and(...conditions))
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
      .where(
        and(
          eq(alertRules.scope, 'customer'),
          eq(alertRules.customerId, customerId),
          eq(alertRules.slug, ruleSlug),
        ),
      )
      .limit(1)
  )[0]
  if (!row) throw new NotFoundError('AlertRule', `${customerSlug}/${ruleSlug}`)
  return rowToAlertRule(row)
}

export async function getWorkspaceAlertRuleBySlug(
  db: Database,
  ruleSlug: string,
): Promise<AlertRule> {
  const row = (
    await db
      .select()
      .from(alertRules)
      .where(
        and(
          eq(alertRules.scope, 'workspace'),
          isNull(alertRules.customerId),
          eq(alertRules.slug, ruleSlug),
        ),
      )
      .limit(1)
  )[0]
  if (!row) throw new NotFoundError('AlertRule', `workspace/${ruleSlug}`)
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
