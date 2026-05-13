import { and, eq, inArray, isNull, or, type SQL } from 'drizzle-orm'
import { normalizeSlug, resolveCustomerId } from '@/lib/customers/resolve'
import type { Database } from '@/lib/db/client'
import { newId } from '@/lib/db/ids'
import { alertRules, channels } from '@/lib/db/schema'
import { FieldValidationError, isUniqueConstraintViolation, NotFoundError } from '@/lib/errors'
import type {
  AlertRule,
  AlertRuleCreateInput,
  AlertRuleUpdateInput,
} from '@/shared/schemas/alert-rule'
import { getAlertRuleBySlug, getWorkspaceAlertRuleBySlug } from './queries'
import { validateChannelScope } from './scope-refinement'

async function assertChannelsResolveAndActive(
  db: Database,
  channelIds: readonly string[],
  scopePredicate: SQL,
  missingMessage: (ids: string[]) => string,
): Promise<void> {
  if (channelIds.length === 0) {
    throw new FieldValidationError({ channelIds: ['Pick at least one Channel'] })
  }
  const rows = await db
    .select({ id: channels.id, status: channels.status, name: channels.name })
    .from(channels)
    .where(and(inArray(channels.id, [...channelIds]), scopePredicate))
  const foundIds = new Set(rows.map((r) => r.id))
  const missing = channelIds.filter((id) => !foundIds.has(id))
  if (missing.length > 0) {
    throw new FieldValidationError({ channelIds: [missingMessage(missing)] })
  }
  const archived = rows.filter((r) => r.status !== 'active')
  if (archived.length > 0) {
    throw new FieldValidationError({
      channelIds: [`Cannot route to archived Channels: ${archived.map((c) => c.name).join(', ')}`],
    })
  }
}

const customerScopePredicate = (customerId: string): SQL =>
  or(eq(channels.scope, 'workspace'), eq(channels.customerId, customerId)) as SQL

const workspaceScopePredicate = (): SQL =>
  and(eq(channels.scope, 'workspace'), isNull(channels.customerId)) as SQL

function serializeConfig(config: AlertRuleCreateInput['config']): string {
  const { kind: _kind, ...rest } = config
  return JSON.stringify(rest)
}

function applyScopeRefinement(result: Awaited<ReturnType<typeof validateChannelScope>>) {
  if (!result.ok) throw new FieldValidationError({ channelIds: [result.detail] })
}

export async function createAlertRule(
  db: Database,
  customerSlug: string,
  input: AlertRuleCreateInput,
): Promise<AlertRule> {
  const customerId = await resolveCustomerId(db, customerSlug)
  await assertChannelsResolveAndActive(
    db,
    input.channelIds,
    customerScopePredicate(customerId),
    (ids) =>
      `Channel ids not available to this Customer (cross-scope or unknown): ${ids.join(', ')}`,
  )
  applyScopeRefinement(
    await validateChannelScope(db, {
      scope: 'customer',
      customerId,
      channelIds: input.channelIds,
    }),
  )
  const slug = normalizeSlug(input.slug)
  const id = newId('rul')
  try {
    await db.insert(alertRules).values({
      id,
      scope: 'customer',
      customerId,
      kind: input.config.kind,
      name: input.name.trim(),
      slug,
      config: serializeConfig(input.config),
      channelIds: JSON.stringify(input.channelIds),
    })
  } catch (err) {
    if (isUniqueConstraintViolation(err, 'alert_rules.slug')) {
      throw new FieldValidationError({
        slug: [`Slug '${slug}' is already in use by another Alert Rule for this Customer`],
      })
    }
    throw err
  }
  return getAlertRuleBySlug(db, customerSlug, slug)
}

export async function updateAlertRule(
  db: Database,
  customerSlug: string,
  ruleSlug: string,
  input: AlertRuleUpdateInput,
): Promise<AlertRule> {
  const customerId = await resolveCustomerId(db, customerSlug)
  await assertChannelsResolveAndActive(
    db,
    input.channelIds,
    customerScopePredicate(customerId),
    (ids) =>
      `Channel ids not available to this Customer (cross-scope or unknown): ${ids.join(', ')}`,
  )
  applyScopeRefinement(
    await validateChannelScope(db, {
      scope: 'customer',
      customerId,
      channelIds: input.channelIds,
    }),
  )
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
        eq(alertRules.scope, 'customer'),
        eq(alertRules.customerId, customerId),
        eq(alertRules.slug, ruleSlug),
      ),
    )
    .returning({ id: alertRules.id })
  if (result.length === 0) throw new NotFoundError('AlertRule', `${customerSlug}/${ruleSlug}`)
  return getAlertRuleBySlug(db, customerSlug, ruleSlug)
}

export async function archiveAlertRule(
  db: Database,
  customerSlug: string,
  ruleSlug: string,
): Promise<AlertRule> {
  const rule = await getAlertRuleBySlug(db, customerSlug, ruleSlug)
  await db
    .update(alertRules)
    .set({ status: 'archived', updatedAt: new Date() })
    .where(eq(alertRules.id, rule.id))
  return getAlertRuleBySlug(db, customerSlug, ruleSlug)
}

export async function restoreAlertRule(
  db: Database,
  customerSlug: string,
  ruleSlug: string,
): Promise<AlertRule> {
  const rule = await getAlertRuleBySlug(db, customerSlug, ruleSlug)
  await db
    .update(alertRules)
    .set({ status: 'active', updatedAt: new Date() })
    .where(eq(alertRules.id, rule.id))
  return getAlertRuleBySlug(db, customerSlug, ruleSlug)
}

export async function createWorkspaceAlertRule(
  db: Database,
  input: AlertRuleCreateInput,
): Promise<AlertRule> {
  await assertChannelsResolveAndActive(
    db,
    input.channelIds,
    workspaceScopePredicate(),
    (ids) =>
      `Workspace AlertRule may reference workspace Channels only. Unknown ids: ${ids.join(', ')}`,
  )
  const slug = normalizeSlug(input.slug)
  const id = newId('rul')
  try {
    await db.insert(alertRules).values({
      id,
      scope: 'workspace',
      customerId: null,
      kind: input.config.kind,
      name: input.name.trim(),
      slug,
      config: serializeConfig(input.config),
      channelIds: JSON.stringify(input.channelIds),
    })
  } catch (err) {
    if (isUniqueConstraintViolation(err, 'alert_rules.slug')) {
      throw new FieldValidationError({
        slug: [`Slug '${slug}' is already in use by another workspace Alert Rule`],
      })
    }
    throw err
  }
  return getWorkspaceAlertRuleBySlug(db, slug)
}

export async function updateWorkspaceAlertRule(
  db: Database,
  ruleSlug: string,
  input: AlertRuleUpdateInput,
): Promise<AlertRule> {
  await assertChannelsResolveAndActive(
    db,
    input.channelIds,
    workspaceScopePredicate(),
    (ids) =>
      `Workspace AlertRule may reference workspace Channels only. Unknown ids: ${ids.join(', ')}`,
  )
  const result = await db
    .update(alertRules)
    .set({
      name: input.name.trim(),
      kind: input.config.kind,
      config: serializeConfig(input.config),
      channelIds: JSON.stringify(input.channelIds),
      updatedAt: new Date(),
    })
    .where(and(eq(alertRules.scope, 'workspace'), eq(alertRules.slug, ruleSlug)))
    .returning({ id: alertRules.id })
  if (result.length === 0) throw new NotFoundError('AlertRule', `workspace/${ruleSlug}`)
  return getWorkspaceAlertRuleBySlug(db, ruleSlug)
}

export async function archiveWorkspaceAlertRule(
  db: Database,
  ruleSlug: string,
): Promise<AlertRule> {
  const rule = await getWorkspaceAlertRuleBySlug(db, ruleSlug)
  await db
    .update(alertRules)
    .set({ status: 'archived', updatedAt: new Date() })
    .where(eq(alertRules.id, rule.id))
  return getWorkspaceAlertRuleBySlug(db, ruleSlug)
}

export async function restoreWorkspaceAlertRule(
  db: Database,
  ruleSlug: string,
): Promise<AlertRule> {
  const rule = await getWorkspaceAlertRuleBySlug(db, ruleSlug)
  await db
    .update(alertRules)
    .set({ status: 'active', updatedAt: new Date() })
    .where(eq(alertRules.id, rule.id))
  return getWorkspaceAlertRuleBySlug(db, ruleSlug)
}
