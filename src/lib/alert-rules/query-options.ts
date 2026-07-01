import { queryOptions } from '@tanstack/react-query'
import { countWorkspaceRulesFn, getAlertRuleFn, listAlertRulesForWorkspaceFn } from './server-fns'

export const alertRuleKeys = {
  all: (workspaceSlug: string) => ['workspaces', workspaceSlug, 'alert-rules'] as const,
  list: (workspaceSlug: string, opts: { includeArchived: boolean }) =>
    [...alertRuleKeys.all(workspaceSlug), opts] as const,
  detail: (workspaceSlug: string, ruleSlug: string) =>
    [...alertRuleKeys.all(workspaceSlug), ruleSlug] as const,
  count: (workspaceSlug: string) => [...alertRuleKeys.all(workspaceSlug), 'count'] as const,
}

export const listAlertRulesQueryOptions = (workspaceSlug: string, includeArchived = false) =>
  queryOptions({
    queryKey: alertRuleKeys.list(workspaceSlug, { includeArchived }),
    queryFn: () => listAlertRulesForWorkspaceFn({ data: { workspaceSlug, includeArchived } }),
  })

export const alertRuleQueryOptions = (workspaceSlug: string, ruleSlug: string) =>
  queryOptions({
    queryKey: alertRuleKeys.detail(workspaceSlug, ruleSlug),
    queryFn: () => getAlertRuleFn({ data: { workspaceSlug, ruleSlug } }),
  })

export const workspaceRuleCountQueryOptions = (workspaceSlug: string) =>
  queryOptions({
    queryKey: alertRuleKeys.count(workspaceSlug),
    queryFn: () => countWorkspaceRulesFn({ data: { workspaceSlug } }),
  })
