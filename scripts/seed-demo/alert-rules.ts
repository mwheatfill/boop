import type { InferInsertModel } from 'drizzle-orm'
import type { alertRules } from '@/lib/db/schema'
import { demoId } from './ids'

type AlertRuleKind = 'first_failure' | 'consecutive_failures' | 'recovery' | 'slow_run'

export type DemoAlertRuleSpec = {
  workspaceSlug: string
  jobSlug: string | null
  slug: string
  name: string
  kind: AlertRuleKind
  config: Record<string, unknown>
  channelSlugs: readonly string[]
}

export const DEMO_ALERT_RULES: readonly DemoAlertRuleSpec[] = [
  // Desert Vista — critical Jobs route to PagerDuty + Teams
  {
    workspaceSlug: 'desert-vista-cu',
    jobSlug: 'ach-transactions-ingest',
    slug: 'ach-first-failure',
    name: 'ACH first failure',
    kind: 'first_failure',
    config: {},
    channelSlugs: ['ops-teams', 'pagerduty-critical'],
  },
  {
    workspaceSlug: 'desert-vista-cu',
    jobSlug: 'ach-transactions-ingest',
    slug: 'ach-recovery',
    name: 'ACH recovery',
    kind: 'recovery',
    config: {},
    channelSlugs: ['ops-teams', 'pagerduty-critical'],
  },
  {
    workspaceSlug: 'desert-vista-cu',
    jobSlug: 'fedline-batch-sync',
    slug: 'fedline-2-consecutive',
    name: 'FedLine 2 consecutive failures',
    kind: 'consecutive_failures',
    config: { count: 2 },
    channelSlugs: ['ops-teams', 'pagerduty-critical'],
  },
  {
    workspaceSlug: 'desert-vista-cu',
    jobSlug: 'card-settlements-reconcile',
    slug: 'card-recon-first-failure',
    name: 'Card reconcile first failure',
    kind: 'first_failure',
    config: {},
    channelSlugs: ['ops-teams', 'compliance-email'],
  },
  {
    workspaceSlug: 'desert-vista-cu',
    jobSlug: 'daily-balances-report',
    slug: 'daily-balances-slow',
    name: 'Daily balances slow run',
    kind: 'slow_run',
    config: { threshold_ms: 30000 },
    channelSlugs: ['ops-teams'],
  },

  // Cactus Title
  {
    workspaceSlug: 'cactus-title',
    jobSlug: 'title-delta-sync',
    slug: 'title-2-consecutive',
    name: 'Title sync 2 consecutive failures',
    kind: 'consecutive_failures',
    config: { count: 2 },
    channelSlugs: ['ops-teams', 'closings-email'],
  },
  {
    workspaceSlug: 'cactus-title',
    jobSlug: 'docusign-token-refresh',
    slug: 'docusign-token-first-failure',
    name: 'DocuSign token failure',
    kind: 'first_failure',
    config: {},
    channelSlugs: ['ops-teams'],
  },

  // Sun Valley
  {
    workspaceSlug: 'sun-valley-insurance',
    jobSlug: 'policy-api-probe',
    slug: 'policy-probe-2-consecutive',
    name: 'Policy probe 2 consecutive failures',
    kind: 'consecutive_failures',
    config: { count: 2 },
    channelSlugs: ['ops-teams', 'autotask-webhook'],
  },
  {
    workspaceSlug: 'sun-valley-insurance',
    jobSlug: 'claims-status-webhook',
    slug: 'claims-webhook-first-failure',
    name: 'Claims webhook first failure',
    kind: 'first_failure',
    config: {},
    channelSlugs: ['ops-teams'],
  },

  // Phoenix Healthcare
  {
    workspaceSlug: 'phoenix-healthcare-partners',
    jobSlug: 'patient-portal-probe',
    slug: 'portal-probe-2-consecutive',
    name: 'Patient portal 2 consecutive failures',
    kind: 'consecutive_failures',
    config: { count: 2 },
    channelSlugs: ['ops-teams', 'pagerduty-critical'],
  },
  {
    workspaceSlug: 'phoenix-healthcare-partners',
    jobSlug: 'patient-portal-probe',
    slug: 'portal-recovery',
    name: 'Patient portal recovery',
    kind: 'recovery',
    config: {},
    channelSlugs: ['ops-teams', 'pagerduty-critical'],
  },

  // Mesa Manufacturing
  {
    workspaceSlug: 'mesa-manufacturing',
    jobSlug: 'shop-floor-status',
    slug: 'shop-floor-slow',
    name: 'Shop floor slow run',
    kind: 'slow_run',
    config: { threshold_ms: 5000 },
    channelSlugs: ['shop-teams'],
  },

  // Tempe Tech
  {
    workspaceSlug: 'tempe-tech-group',
    jobSlug: 'daily-billing-summary',
    slug: 'billing-summary-2-consecutive',
    name: 'Billing summary 2 consecutive failures',
    kind: 'consecutive_failures',
    config: { count: 2 },
    channelSlugs: ['ops-teams', 'billing-email'],
  },

  // SwitchThink
  {
    workspaceSlug: 'switchthink',
    jobSlug: 'sla-probe',
    slug: 'sla-probe-first-failure',
    name: 'SLA probe first failure',
    kind: 'first_failure',
    config: {},
    channelSlugs: ['internal-teams', 'pagerduty-critical', 'oncall-email'],
  },
  {
    workspaceSlug: 'switchthink',
    jobSlug: null, // workspace-wide default
    slug: 'default-2-consecutive',
    name: 'Workspace default - 2 consecutive failures',
    kind: 'consecutive_failures',
    config: { count: 2 },
    channelSlugs: ['internal-teams'],
  },
]

type AlertRuleInsert = InferInsertModel<typeof alertRules>

export function alertRuleRow(
  spec: DemoAlertRuleSpec,
  workspaceId: string,
  jobId: string | null,
  channelIds: readonly string[],
  workspaceCreatedAt: Date,
): AlertRuleInsert {
  const scope = jobId ? ('job' as const) : ('workspace' as const)
  return {
    id: demoId('rul', spec.workspaceSlug, spec.slug),
    scope,
    workspaceId: scope === 'workspace' ? workspaceId : null,
    jobId,
    kind: spec.kind,
    name: spec.name,
    slug: spec.slug,
    config: JSON.stringify(spec.config),
    channelIds: JSON.stringify(channelIds),
    status: 'active',
    lastFiredAt: null,
    createdAt: workspaceCreatedAt,
    updatedAt: workspaceCreatedAt,
  }
}
