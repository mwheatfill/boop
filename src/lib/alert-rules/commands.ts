import { and, eq, inArray } from 'drizzle-orm'
import type { Database } from '@/lib/db/client'
import { newId } from '@/lib/db/ids'
import { alertRules, channels } from '@/lib/db/schema'
import { FieldValidationError, isUniqueConstraintViolation, NotFoundError } from '@/lib/errors'
import { normalizeSlug, resolveWorkspaceId } from '@/lib/workspaces/resolve'
import type {
  AlertRule,
  AlertRuleCreateInput,
  AlertRuleUpdateInput,
} from '@/shared/schemas/alert-rule'
import { getAlertRuleBySlug } from './queries'

async function assertChannelsResolveAndActive(
  db: Database,
  workspaceId: string,
  channelIds: readonly string[],
): Promise<void> {
  if (channelIds.length === 0) {
    throw new FieldValidationError({ channelIds: ['Pick at least one Channel'] })
  }
  const rows = await db
    .select({ id: channels.id, status: channels.status, name: channels.name })
    .from(channels)
    .where(and(inArray(channels.id, [...channelIds]), eq(channels.workspaceId, workspaceId)))
  const foundIds = new Set(rows.map((r) => r.id))
  const missing = channelIds.filter((id) => !foundIds.has(id))
  if (missing.length > 0) {
    throw new FieldValidationError({
      channelIds: [`Channel ids not available to this Workspace: ${missing.join(', ')}`],
    })
  }
  const archived = rows.filter((r) => r.status !== 'active')
  if (archived.length > 0) {
    throw new FieldValidationError({
      channelIds: [`Cannot route to archived Channels: ${archived.map((c) => c.name).join(', ')}`],
    })
  }
}

function serializeConfig(config: AlertRuleCreateInput['config']): string {
  const { kind: _kind, ...rest } = config
  return JSON.stringify(rest)
}

export async function createAlertRule(
  db: Database,
  workspaceSlug: string,
  input: AlertRuleCreateInput,
): Promise<AlertRule> {
  const workspaceId = await resolveWorkspaceId(db, workspaceSlug)
  await assertChannelsResolveAndActive(db, workspaceId, input.channelIds)
  const slug = normalizeSlug(input.slug)
  const id = newId('rul')
  try {
    await db.insert(alertRules).values({
      id,
      scope: 'workspace',
      workspaceId,
      kind: input.config.kind,
      name: input.name.trim(),
      slug,
      config: serializeConfig(input.config),
      channelIds: JSON.stringify(input.channelIds),
    })
  } catch (err) {
    if (isUniqueConstraintViolation(err, 'alert_rules.slug')) {
      throw new FieldValidationError({
        slug: [`Slug '${slug}' is already in use by another Alert Rule for this Workspace`],
      })
    }
    throw err
  }
  return getAlertRuleBySlug(db, workspaceSlug, slug)
}

export async function updateAlertRule(
  db: Database,
  workspaceSlug: string,
  ruleSlug: string,
  input: AlertRuleUpdateInput,
): Promise<AlertRule> {
  const workspaceId = await resolveWorkspaceId(db, workspaceSlug)
  await assertChannelsResolveAndActive(db, workspaceId, input.channelIds)
  const result = await db
    .update(alertRules)
    .set({
      name: input.name.trim(),
      kind: input.config.kind,
      config: serializeConfig(input.config),
      channelIds: JSON.stringify(input.channelIds),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(alertRules.scope, 'workspace'),
        eq(alertRules.workspaceId, workspaceId),
        eq(alertRules.slug, ruleSlug),
      ),
    )
    .returning({ id: alertRules.id })
  if (result.length === 0) throw new NotFoundError('AlertRule', `${workspaceSlug}/${ruleSlug}`)
  return getAlertRuleBySlug(db, workspaceSlug, ruleSlug)
}

export async function archiveAlertRule(
  db: Database,
  workspaceSlug: string,
  ruleSlug: string,
): Promise<AlertRule> {
  const rule = await getAlertRuleBySlug(db, workspaceSlug, ruleSlug)
  await db
    .update(alertRules)
    .set({ status: 'archived', updatedAt: new Date() })
    .where(eq(alertRules.id, rule.id))
  return getAlertRuleBySlug(db, workspaceSlug, ruleSlug)
}

export async function restoreAlertRule(
  db: Database,
  workspaceSlug: string,
  ruleSlug: string,
): Promise<AlertRule> {
  const rule = await getAlertRuleBySlug(db, workspaceSlug, ruleSlug)
  await db
    .update(alertRules)
    .set({ status: 'active', updatedAt: new Date() })
    .where(eq(alertRules.id, rule.id))
  return getAlertRuleBySlug(db, workspaceSlug, ruleSlug)
}
