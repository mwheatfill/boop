import { env } from 'cloudflare:workers'
import { createServerFn } from '@tanstack/react-start'
import { authMiddleware } from '@/lib/auth/auth-middleware'
import { createDb } from '@/lib/db/client'
import { asMutationFailure, type MutationResult } from '@/lib/mutation-result'
import {
  type AlertRule,
  AlertRuleCreateInput,
  AlertRuleUpdateInput,
} from '@/shared/schemas/alert-rule'
import { z } from '@/shared/schemas/openapi'
import { archiveAlertRule, createAlertRule, restoreAlertRule, updateAlertRule } from './commands'
import { countCustomerRulesForJob, getAlertRuleBySlug, listAlertRulesForCustomer } from './queries'

const slugPair = z.object({
  customerSlug: z.string().min(1),
  ruleSlug: z.string().min(1),
})

export const listAlertRulesForCustomerFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator((data: { customerSlug: string; includeArchived?: boolean }) =>
    z
      .object({ customerSlug: z.string().min(1), includeArchived: z.boolean().optional() })
      .parse(data),
  )
  .handler(async ({ data }) =>
    listAlertRulesForCustomer(
      createDb(env.DB),
      data.customerSlug,
      data.includeArchived ? { includeArchived: true } : {},
    ),
  )

export const getAlertRuleFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator((data) => slugPair.parse(data))
  .handler(async ({ data }) =>
    getAlertRuleBySlug(createDb(env.DB), data.customerSlug, data.ruleSlug),
  )

export const countCustomerRulesFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator((data: { customerSlug: string }) =>
    z.object({ customerSlug: z.string().min(1) }).parse(data),
  )
  .handler(async ({ data }) => ({
    count: await countCustomerRulesForJob(createDb(env.DB), data.customerSlug),
  }))

export const createAlertRuleFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator((data: { customerSlug: string } & z.infer<typeof AlertRuleCreateInput>) =>
    z
      .object({ customerSlug: z.string().min(1) })
      .extend(AlertRuleCreateInput.shape)
      .parse(data),
  )
  .handler(async ({ data }): Promise<MutationResult<AlertRule>> => {
    const { customerSlug, ...input } = data
    try {
      const rule = await createAlertRule(createDb(env.DB), customerSlug, input)
      return { ok: true, data: rule }
    } catch (err) {
      const failure = asMutationFailure(err)
      if (failure) return failure
      throw err
    }
  })

export const updateAlertRuleFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(
    (data: { customerSlug: string; ruleSlug: string } & z.infer<typeof AlertRuleUpdateInput>) =>
      slugPair.extend(AlertRuleUpdateInput.shape).parse(data),
  )
  .handler(async ({ data }): Promise<MutationResult<AlertRule>> => {
    const { customerSlug, ruleSlug, ...input } = data
    try {
      const rule = await updateAlertRule(createDb(env.DB), customerSlug, ruleSlug, input)
      return { ok: true, data: rule }
    } catch (err) {
      const failure = asMutationFailure(err)
      if (failure) return failure
      throw err
    }
  })

export const archiveAlertRuleFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator((data) => slugPair.parse(data))
  .handler(async ({ data }) => ({
    ok: true as const,
    data: await archiveAlertRule(createDb(env.DB), data.customerSlug, data.ruleSlug),
  }))

export const restoreAlertRuleFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator((data) => slugPair.parse(data))
  .handler(async ({ data }) => ({
    ok: true as const,
    data: await restoreAlertRule(createDb(env.DB), data.customerSlug, data.ruleSlug),
  }))
