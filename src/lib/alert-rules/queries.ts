import { and, asc, eq, sql } from 'drizzle-orm'
import type { Database } from '@/lib/db/client'
import { alertRules } from '@/lib/db/schema'
import { NotFoundError } from '@/lib/errors'
import { resolveWorkspaceId } from '@/lib/workspaces/resolve'
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
    workspaceId: row.workspaceId,
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

export async function listAlertRulesForWorkspace(
  db: Database,
  workspaceSlug: string,
  { includeArchived = false }: { includeArchived?: boolean } = {},
): Promise<AlertRule[]> {
  const workspaceId = await resolveWorkspaceId(db, workspaceSlug)
  const conditions = [eq(alertRules.scope, 'workspace'), eq(alertRules.workspaceId, workspaceId)]
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
  workspaceSlug: string,
  ruleSlug: string,
): Promise<AlertRule> {
  const workspaceId = await resolveWorkspaceId(db, workspaceSlug)
  const row = (
    await db
      .select()
      .from(alertRules)
      .where(
        and(
          eq(alertRules.scope, 'workspace'),
          eq(alertRules.workspaceId, workspaceId),
          eq(alertRules.slug, ruleSlug),
        ),
      )
      .limit(1)
  )[0]
  if (!row) throw new NotFoundError('AlertRule', `${workspaceSlug}/${ruleSlug}`)
  return rowToAlertRule(row)
}

export async function countWorkspaceRulesForJob(
  db: Database,
  workspaceSlug: string,
): Promise<number> {
  const workspaceId = await resolveWorkspaceId(db, workspaceSlug)
  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(alertRules)
    .where(and(eq(alertRules.workspaceId, workspaceId), eq(alertRules.status, 'active')))
  return row?.count ?? 0
}
