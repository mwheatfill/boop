import { queryOptions } from '@tanstack/react-query'
import {
  countCustomerRulesFn,
  getAlertRuleFn,
  getWorkspaceAlertRuleFn,
  listAlertRulesForCustomerFn,
  listWorkspaceAlertRulesFn,
} from './server-fns'

export const listAlertRulesQueryOptions = (customerSlug: string, includeArchived = false) =>
  queryOptions({
    queryKey: ['customers', customerSlug, 'alert-rules', { includeArchived }],
    queryFn: () => listAlertRulesForCustomerFn({ data: { customerSlug, includeArchived } }),
  })

export const alertRuleQueryOptions = (customerSlug: string, ruleSlug: string) =>
  queryOptions({
    queryKey: ['customers', customerSlug, 'alert-rules', ruleSlug],
    queryFn: () => getAlertRuleFn({ data: { customerSlug, ruleSlug } }),
  })

export const customerRuleCountQueryOptions = (customerSlug: string) =>
  queryOptions({
    queryKey: ['customers', customerSlug, 'alert-rules', 'count'],
    queryFn: () => countCustomerRulesFn({ data: { customerSlug } }),
  })

export const workspaceAlertRulesQueryOptions = (includeArchived = false) =>
  queryOptions({
    queryKey: ['workspace', 'alert-rules', { includeArchived }],
    queryFn: () => listWorkspaceAlertRulesFn({ data: { includeArchived } }),
  })

export const workspaceAlertRuleQueryOptions = (ruleSlug: string) =>
  queryOptions({
    queryKey: ['workspace', 'alert-rules', ruleSlug],
    queryFn: () => getWorkspaceAlertRuleFn({ data: { ruleSlug } }),
  })
