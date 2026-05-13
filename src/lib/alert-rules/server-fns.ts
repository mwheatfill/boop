import { env } from 'cloudflare:workers'
import { createServerFn } from '@tanstack/react-start'
import { adminMiddleware } from '@/lib/auth/admin-middleware'
import { authMiddleware } from '@/lib/auth/auth-middleware'
import { createDb } from '@/lib/db/client'
import { asMutationFailure, type MutationResult, runMutation } from '@/lib/mutation-result'
import {
  type AlertRule,
  AlertRuleCreateInput,
  AlertRuleUpdateInput,
} from '@/shared/schemas/alert-rule'
import { z } from '@/shared/schemas/openapi'
import {
  archiveAlertRule,
  archiveWorkspaceAlertRule,
  createAlertRule,
  createWorkspaceAlertRule,
  restoreAlertRule,
  restoreWorkspaceAlertRule,
  updateAlertRule,
  updateWorkspaceAlertRule,
} from './commands'
import {
  countCustomerRulesForJob,
  getAlertRuleBySlug,
  getWorkspaceAlertRuleBySlug,
  listAlertRulesForCustomer,
  listWorkspaceAlertRules,
} from './queries'

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

const ruleSlugOnly = z.object({ ruleSlug: z.string().min(1) })

export const listWorkspaceAlertRulesFn = createServerFn({ method: 'GET' })
  .middleware([adminMiddleware])
  .inputValidator((data: { includeArchived?: boolean }) =>
    z.object({ includeArchived: z.boolean().optional() }).parse(data),
  )
  .handler(async ({ data }) =>
    listWorkspaceAlertRules(
      createDb(env.DB),
      data.includeArchived ? { includeArchived: true } : {},
    ),
  )

export const getWorkspaceAlertRuleFn = createServerFn({ method: 'GET' })
  .middleware([adminMiddleware])
  .inputValidator((data) => ruleSlugOnly.parse(data))
  .handler(async ({ data }) => getWorkspaceAlertRuleBySlug(createDb(env.DB), data.ruleSlug))

export const createWorkspaceAlertRuleFn = createServerFn({ method: 'POST' })
  .middleware([adminMiddleware])
  .inputValidator((data: z.infer<typeof AlertRuleCreateInput>) => AlertRuleCreateInput.parse(data))
  .handler(({ data }) => runMutation(() => createWorkspaceAlertRule(createDb(env.DB), data)))

export const updateWorkspaceAlertRuleFn = createServerFn({ method: 'POST' })
  .middleware([adminMiddleware])
  .inputValidator((data: { ruleSlug: string } & z.infer<typeof AlertRuleUpdateInput>) =>
    ruleSlugOnly.extend(AlertRuleUpdateInput.shape).parse(data),
  )
  .handler(({ data }) => {
    const { ruleSlug, ...input } = data
    return runMutation(() => updateWorkspaceAlertRule(createDb(env.DB), ruleSlug, input))
  })

export const archiveWorkspaceAlertRuleFn = createServerFn({ method: 'POST' })
  .middleware([adminMiddleware])
  .inputValidator((data) => ruleSlugOnly.parse(data))
  .handler(async ({ data }) => ({
    ok: true as const,
    data: await archiveWorkspaceAlertRule(createDb(env.DB), data.ruleSlug),
  }))

export const restoreWorkspaceAlertRuleFn = createServerFn({ method: 'POST' })
  .middleware([adminMiddleware])
  .inputValidator((data) => ruleSlugOnly.parse(data))
  .handler(async ({ data }) => ({
    ok: true as const,
    data: await restoreWorkspaceAlertRule(createDb(env.DB), data.ruleSlug),
  }))
