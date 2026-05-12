import { queryOptions } from '@tanstack/react-query'
import { countCustomerRulesFn, getAlertRuleFn, listAlertRulesForCustomerFn } from './server-fns'

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
