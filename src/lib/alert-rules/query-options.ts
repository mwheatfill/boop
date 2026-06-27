import { queryOptions } from '@tanstack/react-query'
import { countWorkspaceRulesFn, getAlertRuleFn, listAlertRulesForWorkspaceFn } from './server-fns'

export const listAlertRulesQueryOptions = (workspaceSlug: string, includeArchived = false) =>
  queryOptions({
    queryKey: ['workspaces', workspaceSlug, 'alert-rules', { includeArchived }],
    queryFn: () => listAlertRulesForWorkspaceFn({ data: { workspaceSlug, includeArchived } }),
  })

export const alertRuleQueryOptions = (workspaceSlug: string, ruleSlug: string) =>
  queryOptions({
    queryKey: ['workspaces', workspaceSlug, 'alert-rules', ruleSlug],
    queryFn: () => getAlertRuleFn({ data: { workspaceSlug, ruleSlug } }),
  })

export const workspaceRuleCountQueryOptions = (workspaceSlug: string) =>
  queryOptions({
    queryKey: ['workspaces', workspaceSlug, 'alert-rules', 'count'],
    queryFn: () => countWorkspaceRulesFn({ data: { workspaceSlug } }),
  })
