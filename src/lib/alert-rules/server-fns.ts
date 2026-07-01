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
import type { z } from '@/shared/schemas/openapi'
import {
  AlertRuleSlugPairInput,
  IncludeArchivedInput,
  WorkspaceSlugInput,
} from '@/shared/schemas/resource-refs'
import { archiveAlertRule, createAlertRule, restoreAlertRule, updateAlertRule } from './commands'
import {
  countWorkspaceRulesForJob,
  getAlertRuleBySlug,
  listAlertRulesForWorkspace,
} from './queries'

export const listAlertRulesForWorkspaceFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator((data: { workspaceSlug: string; includeArchived?: boolean }) =>
    WorkspaceSlugInput.extend(IncludeArchivedInput.shape).parse(data),
  )
  .handler(async ({ data }) =>
    listAlertRulesForWorkspace(
      createDb(env.DB),
      data.workspaceSlug,
      data.includeArchived ? { includeArchived: true } : {},
    ),
  )

export const getAlertRuleFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator((data) => AlertRuleSlugPairInput.parse(data))
  .handler(async ({ data }) =>
    getAlertRuleBySlug(createDb(env.DB), data.workspaceSlug, data.ruleSlug),
  )

export const countWorkspaceRulesFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator((data: { workspaceSlug: string }) => WorkspaceSlugInput.parse(data))
  .handler(async ({ data }) => ({
    count: await countWorkspaceRulesForJob(createDb(env.DB), data.workspaceSlug),
  }))

export const createAlertRuleFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator((data: { workspaceSlug: string } & z.infer<typeof AlertRuleCreateInput>) =>
    WorkspaceSlugInput.extend(AlertRuleCreateInput.shape).parse(data),
  )
  .handler(async ({ data }): Promise<MutationResult<AlertRule>> => {
    const { workspaceSlug, ...input } = data
    try {
      const rule = await createAlertRule(createDb(env.DB), workspaceSlug, input)
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
    (data: { workspaceSlug: string; ruleSlug: string } & z.infer<typeof AlertRuleUpdateInput>) =>
      AlertRuleSlugPairInput.extend(AlertRuleUpdateInput.shape).parse(data),
  )
  .handler(async ({ data }): Promise<MutationResult<AlertRule>> => {
    const { workspaceSlug, ruleSlug, ...input } = data
    try {
      const rule = await updateAlertRule(createDb(env.DB), workspaceSlug, ruleSlug, input)
      return { ok: true, data: rule }
    } catch (err) {
      const failure = asMutationFailure(err)
      if (failure) return failure
      throw err
    }
  })

export const archiveAlertRuleFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator((data) => AlertRuleSlugPairInput.parse(data))
  .handler(async ({ data }) => ({
    ok: true as const,
    data: await archiveAlertRule(createDb(env.DB), data.workspaceSlug, data.ruleSlug),
  }))

export const restoreAlertRuleFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator((data) => AlertRuleSlugPairInput.parse(data))
  .handler(async ({ data }) => ({
    ok: true as const,
    data: await restoreAlertRule(createDb(env.DB), data.workspaceSlug, data.ruleSlug),
  }))
