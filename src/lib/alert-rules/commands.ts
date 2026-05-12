import { and, eq, inArray } from 'drizzle-orm'
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
import { getAlertRuleBySlug } from './queries'

async function validateChannelIds(
  db: Database,
  customerId: string,
  channelIds: readonly string[],
): Promise<void> {
  if (channelIds.length === 0) {
    throw new FieldValidationError({ channelIds: ['Pick at least one Channel'] })
  }
  const rows = await db
    .select({ id: channels.id, status: channels.status, name: channels.name })
    .from(channels)
    .where(and(eq(channels.customerId, customerId), inArray(channels.id, [...channelIds])))
  const foundIds = new Set(rows.map((r) => r.id))
  const missing = channelIds.filter((id) => !foundIds.has(id))
  if (missing.length > 0) {
    throw new FieldValidationError({
      channelIds: [`Channel ids not found for this Customer: ${missing.join(', ')}`],
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
  customerSlug: string,
  input: AlertRuleCreateInput,
): Promise<AlertRule> {
  const customerId = await resolveCustomerId(db, customerSlug)
  await validateChannelIds(db, customerId, input.channelIds)
  const slug = normalizeSlug(input.slug)
  const id = newId('rul')
  try {
    await db.insert(alertRules).values({
      id,
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
  await validateChannelIds(db, customerId, input.channelIds)
  const result = await db
    .update(alertRules)
    .set({
      name: input.name.trim(),
      kind: input.config.kind,
      config: serializeConfig(input.config),
      channelIds: JSON.stringify(input.channelIds),
      updatedAt: new Date(),
    })
    .where(and(eq(alertRules.customerId, customerId), eq(alertRules.slug, ruleSlug)))
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
