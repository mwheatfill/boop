import type { InferInsertModel } from 'drizzle-orm'
import type { jobs } from '@/lib/db/schema'
import { demoId } from './ids'

export type JobCategory =
  | 'health-check'
  | 'data-sync'
  | 'reconciliation'
  | 'reports'
  | 'cleanup'
  | 'cache-warming'
  | 'token-refresh'
  | 'workflow-ticks'
  | 'webhook-receiver'

export type DistributionPattern =
  | 'steady-healthy'
  | 'recent-outage'
  | 'actively-failing'
  | 'high-variance'
  | 'paused'

type TriggerKind = 'cron' | 'interval' | 'webhook'

export type DemoJobSpec = {
  workspaceSlug: string
  targetSlug: string
  slug: string
  name: string
  category: JobCategory
  triggerKind: TriggerKind
  cronExpression: string | null
  intervalSeconds: number | null
  triggerTimezone: string | null
  bodyTemplate: string
  headersTemplate: string
  maxAttempts: number
  overallDeadlineMs: number
  pattern: DistributionPattern
  latencyBaseMs: number
  latencyJitterMs: number
}

const BODY_NONE = ''
const BODY_RUN_TICK = JSON.stringify({ run_id: '{{ run_id }}', at: '{{ now | iso_date }}' })
const BODY_SYNC = JSON.stringify({
  run_id: '{{ run_id }}',
  cursor: 'incremental',
  since: '{{ now | iso_date }}',
})
const HEADERS_JSON = JSON.stringify({ accept: 'application/json' })

export const DEMO_JOBS: readonly DemoJobSpec[] = [
  // ---------------- Health checks (interval) ----------------
  job(
    'desert-vista-cu',
    'health-probe',
    'core-banking-probe',
    'Core Banking Probe',
    'health-check',
    {
      triggerKind: 'interval',
      intervalSeconds: 30,
      pattern: 'steady-healthy',
      latencyBaseMs: 140,
      latencyJitterMs: 90,
    },
  ),
  job('desert-vista-cu', 'health-probe', 'fedline-probe', 'FedLine Heartbeat', 'health-check', {
    triggerKind: 'interval',
    intervalSeconds: 60,
    pattern: 'steady-healthy',
    latencyBaseMs: 180,
    latencyJitterMs: 80,
  }),
  job(
    'sun-valley-insurance',
    'policy-api',
    'policy-api-probe',
    'Policy API Probe',
    'health-check',
    {
      triggerKind: 'interval',
      intervalSeconds: 60,
      pattern: 'recent-outage',
      latencyBaseMs: 220,
      latencyJitterMs: 120,
    },
  ),
  job(
    'phoenix-healthcare-partners',
    'health-probe',
    'patient-portal-probe',
    'Patient Portal Probe',
    'health-check',
    {
      triggerKind: 'interval',
      intervalSeconds: 45,
      pattern: 'steady-healthy',
      latencyBaseMs: 165,
      latencyJitterMs: 100,
    },
  ),
  job('switchthink', 'health-probe', 'sla-probe', 'SLA Probe', 'health-check', {
    triggerKind: 'interval',
    intervalSeconds: 30,
    pattern: 'steady-healthy',
    latencyBaseMs: 110,
    latencyJitterMs: 60,
  }),
  job('switchthink', 'sla-monitor', 'internal-sla-watch', 'Internal SLA Watch', 'health-check', {
    triggerKind: 'interval',
    intervalSeconds: 45,
    pattern: 'steady-healthy',
    latencyBaseMs: 130,
    latencyJitterMs: 70,
  }),

  // ---------------- Data sync (cron) ----------------
  job(
    'desert-vista-cu',
    'core-banking',
    'ach-transactions-ingest',
    'ACH Transactions Ingest',
    'data-sync',
    {
      triggerKind: 'cron',
      cronExpression: '*/15 * * * *',
      pattern: 'steady-healthy',
      latencyBaseMs: 800,
      latencyJitterMs: 600,
    },
  ),
  job('desert-vista-cu', 'fedline', 'fedline-batch-sync', 'FedLine Batch Sync', 'data-sync', {
    triggerKind: 'cron',
    cronExpression: '*/30 * * * *',
    pattern: 'steady-healthy',
    latencyBaseMs: 1100,
    latencyJitterMs: 800,
  }),
  job('cactus-title', 'title-system', 'title-delta-sync', 'Title Delta Sync', 'data-sync', {
    triggerKind: 'cron',
    cronExpression: '*/10 * * * *',
    pattern: 'steady-healthy',
    latencyBaseMs: 600,
    latencyJitterMs: 500,
  }),
  job(
    'sun-valley-insurance',
    'carrier-sync',
    'carrier-policy-sync',
    'Carrier Policy Sync',
    'data-sync',
    {
      triggerKind: 'cron',
      cronExpression: '*/20 * * * *',
      pattern: 'high-variance',
      latencyBaseMs: 700,
      latencyJitterMs: 2400,
    },
  ),
  job('mesa-manufacturing', 'erp-sync', 'shop-orders-sync', 'Shop Orders Sync', 'data-sync', {
    triggerKind: 'cron',
    cronExpression: '*/15 * * * *',
    pattern: 'steady-healthy',
    latencyBaseMs: 950,
    latencyJitterMs: 600,
  }),
  job('salt-river-logistics', 'tms', 'shipments-sync', 'Shipments Sync', 'data-sync', {
    triggerKind: 'cron',
    cronExpression: '*/5 * * * *',
    triggerTimezone: 'America/Phoenix',
    pattern: 'steady-healthy',
    latencyBaseMs: 450,
    latencyJitterMs: 300,
  }),
  job('phoenix-healthcare-partners', 'ehr-bridge', 'ehr-pull', 'EHR Pull', 'data-sync', {
    triggerKind: 'cron',
    cronExpression: '*/30 * * * *',
    pattern: 'steady-healthy',
    latencyBaseMs: 1500,
    latencyJitterMs: 700,
  }),

  // ---------------- Reconciliation (cron hourly) ----------------
  job('desert-vista-cu', 'core-banking', 'gl-reconcile', 'GL Reconcile', 'reconciliation', {
    triggerKind: 'cron',
    cronExpression: '15 * * * *',
    pattern: 'steady-healthy',
    latencyBaseMs: 2400,
    latencyJitterMs: 1100,
  }),
  job(
    'desert-vista-cu',
    'card-processor',
    'card-settlements-reconcile',
    'Card Settlements Reconcile',
    'reconciliation',
    {
      triggerKind: 'cron',
      cronExpression: '45 * * * *',
      pattern: 'actively-failing',
      latencyBaseMs: 1200,
      latencyJitterMs: 800,
    },
  ),
  job(
    'cactus-title',
    'title-system',
    'closings-reconcile',
    'Closings Reconcile',
    'reconciliation',
    {
      triggerKind: 'cron',
      cronExpression: '30 * * * *',
      pattern: 'steady-healthy',
      latencyBaseMs: 1700,
      latencyJitterMs: 900,
    },
  ),

  // ---------------- Reports (cron daily/weekly/monthly) ----------------
  job(
    'desert-vista-cu',
    'core-banking',
    'daily-balances-report',
    'Daily Balances Report',
    'reports',
    {
      triggerKind: 'cron',
      cronExpression: '0 6 * * *',
      pattern: 'steady-healthy',
      latencyBaseMs: 4200,
      latencyJitterMs: 1500,
    },
  ),
  job('desert-vista-cu', 'core-banking', 'weekly-loan-report', 'Weekly Loan Report', 'reports', {
    triggerKind: 'cron',
    cronExpression: '0 7 * * 1',
    pattern: 'steady-healthy',
    latencyBaseMs: 5200,
    latencyJitterMs: 2000,
  }),
  job(
    'desert-vista-cu',
    'core-banking',
    'monthly-regulatory-report',
    'Monthly Regulatory Report',
    'reports',
    {
      triggerKind: 'cron',
      cronExpression: '0 8 1 * *',
      pattern: 'steady-healthy',
      latencyBaseMs: 7800,
      latencyJitterMs: 2400,
    },
  ),
  job('switchthink', 'sla-monitor', 'daily-sla-roll-up', 'Daily SLA Roll-up', 'reports', {
    triggerKind: 'cron',
    cronExpression: '0 7 * * *',
    pattern: 'steady-healthy',
    latencyBaseMs: 3200,
    latencyJitterMs: 1200,
  }),
  job('tempe-tech-group', 'reports', 'daily-billing-summary', 'Daily Billing Summary', 'reports', {
    triggerKind: 'cron',
    cronExpression: '30 6 * * *',
    pattern: 'steady-healthy',
    latencyBaseMs: 2600,
    latencyJitterMs: 1000,
  }),
  job('skyline-realty-trust', 'reports', 'weekly-sales-report', 'Weekly Sales Report', 'reports', {
    triggerKind: 'cron',
    cronExpression: '0 9 * * 1',
    pattern: 'steady-healthy',
    latencyBaseMs: 3400,
    latencyJitterMs: 1500,
  }),

  // ---------------- Cleanup (cron daily/weekly) ----------------
  job(
    'desert-vista-cu',
    'core-banking',
    'archive-old-statements',
    'Archive Old Statements',
    'cleanup',
    {
      triggerKind: 'cron',
      cronExpression: '0 2 * * *',
      pattern: 'steady-healthy',
      latencyBaseMs: 5600,
      latencyJitterMs: 2200,
    },
  ),
  job('desert-vista-cu', 'core-banking', 'prune-temp-files', 'Prune Temp Files', 'cleanup', {
    triggerKind: 'cron',
    cronExpression: '0 3 * * *',
    pattern: 'paused',
    latencyBaseMs: 1200,
    latencyJitterMs: 600,
  }),
  job('switchthink', 'ops-cleanup', 'rotate-logs', 'Rotate Logs', 'cleanup', {
    triggerKind: 'cron',
    cronExpression: '15 2 * * *',
    pattern: 'steady-healthy',
    latencyBaseMs: 900,
    latencyJitterMs: 400,
  }),
  job('switchthink', 'ops-cleanup', 'expire-stale-sessions', 'Expire Stale Sessions', 'cleanup', {
    triggerKind: 'cron',
    cronExpression: '0 4 * * 0',
    pattern: 'steady-healthy',
    latencyBaseMs: 800,
    latencyJitterMs: 350,
  }),

  // ---------------- Cache warming (cron frequent) ----------------
  job(
    'desert-vista-cu',
    'core-banking',
    'warm-account-cache',
    'Warm Account Cache',
    'cache-warming',
    {
      triggerKind: 'cron',
      cronExpression: '*/5 * * * *',
      pattern: 'steady-healthy',
      latencyBaseMs: 320,
      latencyJitterMs: 200,
    },
  ),
  job('desert-vista-cu', 'core-banking', 'warm-rates-table', 'Warm Rates Table', 'cache-warming', {
    triggerKind: 'cron',
    cronExpression: '*/3 * * * *',
    pattern: 'steady-healthy',
    latencyBaseMs: 220,
    latencyJitterMs: 120,
  }),
  job(
    'phoenix-healthcare-partners',
    'patient-portal',
    'warm-provider-directory',
    'Warm Provider Directory',
    'cache-warming',
    {
      triggerKind: 'cron',
      cronExpression: '*/10 * * * *',
      pattern: 'steady-healthy',
      latencyBaseMs: 380,
      latencyJitterMs: 220,
    },
  ),

  // ---------------- Token refresh (cron ~45-50 min) ----------------
  job(
    'desert-vista-cu',
    'fedline',
    'fedline-token-refresh',
    'FedLine OAuth Token Refresh',
    'token-refresh',
    {
      triggerKind: 'cron',
      cronExpression: '*/45 * * * *',
      pattern: 'steady-healthy',
      latencyBaseMs: 280,
      latencyJitterMs: 120,
    },
  ),
  job(
    'sun-valley-insurance',
    'carrier-sync',
    'carrier-token-refresh',
    'Carrier OAuth Token Refresh',
    'token-refresh',
    {
      triggerKind: 'cron',
      cronExpression: '*/50 * * * *',
      pattern: 'steady-healthy',
      latencyBaseMs: 240,
      latencyJitterMs: 100,
    },
  ),
  job(
    'cactus-title',
    'docusign',
    'docusign-token-refresh',
    'DocuSign OAuth Token Refresh',
    'token-refresh',
    {
      triggerKind: 'cron',
      cronExpression: '*/45 * * * *',
      pattern: 'recent-outage',
      latencyBaseMs: 320,
      latencyJitterMs: 140,
    },
  ),

  // ---------------- Workflow ticks (cron business hours) ----------------
  job(
    'desert-vista-cu',
    'core-banking',
    'loan-approval-workflow',
    'Loan Approval Workflow',
    'workflow-ticks',
    {
      triggerKind: 'cron',
      cronExpression: '*/10 8-17 * * 1-5',
      pattern: 'steady-healthy',
      latencyBaseMs: 1400,
      latencyJitterMs: 700,
    },
  ),
  job(
    'desert-vista-cu',
    'core-banking',
    'dispute-resolution-tick',
    'Dispute Resolution Tick',
    'workflow-ticks',
    {
      triggerKind: 'cron',
      cronExpression: '*/15 8-17 * * 1-5',
      pattern: 'steady-healthy',
      latencyBaseMs: 1700,
      latencyJitterMs: 900,
    },
  ),
  job(
    'cactus-title',
    'title-system',
    'closing-progress-tick',
    'Closing Progress Tick',
    'workflow-ticks',
    {
      triggerKind: 'cron',
      cronExpression: '*/20 8-17 * * 1-5',
      pattern: 'recent-outage',
      latencyBaseMs: 1300,
      latencyJitterMs: 700,
    },
  ),
  job(
    'mesa-manufacturing',
    'shop-floor',
    'shop-floor-status',
    'Shop Floor Status',
    'workflow-ticks',
    {
      triggerKind: 'cron',
      cronExpression: '*/15 6-18 * * 1-5',
      pattern: 'high-variance',
      latencyBaseMs: 950,
      latencyJitterMs: 1600,
    },
  ),

  // ---------------- Webhook receivers ----------------
  job(
    'desert-vista-cu',
    'card-processor',
    'card-processor-webhook',
    'Card Processor Webhook',
    'webhook-receiver',
    {
      triggerKind: 'webhook',
      pattern: 'steady-healthy',
      latencyBaseMs: 180,
      latencyJitterMs: 120,
    },
  ),
  job(
    'desert-vista-cu',
    'core-banking',
    'core-event-webhook',
    'Core Event Webhook',
    'webhook-receiver',
    {
      triggerKind: 'webhook',
      pattern: 'steady-healthy',
      latencyBaseMs: 210,
      latencyJitterMs: 130,
    },
  ),
  job(
    'cactus-title',
    'docusign',
    'docusign-status-webhook',
    'DocuSign Status Webhook',
    'webhook-receiver',
    {
      triggerKind: 'webhook',
      pattern: 'steady-healthy',
      latencyBaseMs: 260,
      latencyJitterMs: 140,
    },
  ),
  job(
    'sun-valley-insurance',
    'webhook-claims',
    'claims-status-webhook',
    'Claims Status Webhook',
    'webhook-receiver',
    {
      triggerKind: 'webhook',
      pattern: 'actively-failing',
      latencyBaseMs: 240,
      latencyJitterMs: 120,
    },
  ),
  job(
    'switchthink',
    'autotask-sync',
    'autotask-event-webhook',
    'Autotask Event Webhook',
    'webhook-receiver',
    {
      triggerKind: 'webhook',
      pattern: 'steady-healthy',
      latencyBaseMs: 300,
      latencyJitterMs: 160,
    },
  ),
]

type JobOverrides = {
  triggerKind: TriggerKind
  cronExpression?: string
  intervalSeconds?: number
  triggerTimezone?: string
  bodyTemplate?: string
  headersTemplate?: string
  maxAttempts?: number
  overallDeadlineMs?: number
  pattern: DistributionPattern
  latencyBaseMs: number
  latencyJitterMs: number
}

function job(
  workspaceSlug: string,
  targetSlug: string,
  slug: string,
  name: string,
  category: JobCategory,
  overrides: JobOverrides,
): DemoJobSpec {
  const isWebhook = overrides.triggerKind === 'webhook'
  return {
    workspaceSlug,
    targetSlug,
    slug,
    name,
    category,
    triggerKind: overrides.triggerKind,
    cronExpression: overrides.cronExpression ?? null,
    intervalSeconds: overrides.intervalSeconds ?? null,
    triggerTimezone: overrides.triggerTimezone ?? null,
    bodyTemplate:
      overrides.bodyTemplate ??
      (category === 'health-check' || category === 'cache-warming'
        ? BODY_NONE
        : category === 'data-sync'
          ? BODY_SYNC
          : BODY_RUN_TICK),
    headersTemplate: overrides.headersTemplate ?? HEADERS_JSON,
    maxAttempts: overrides.maxAttempts ?? (isWebhook ? 1 : 3),
    overallDeadlineMs:
      overrides.overallDeadlineMs ??
      (category === 'reports' || category === 'cleanup' ? 300_000 : 60_000),
    pattern: overrides.pattern,
    latencyBaseMs: overrides.latencyBaseMs,
    latencyJitterMs: overrides.latencyJitterMs,
  }
}

type JobInsert = InferInsertModel<typeof jobs>

export function jobRow(
  spec: DemoJobSpec,
  workspaceId: string,
  targetId: string,
  workspaceCreatedAt: Date,
): JobInsert {
  return {
    id: demoId('job', spec.workspaceSlug, spec.slug),
    workspaceId,
    targetId,
    name: spec.name,
    slug: spec.slug,
    triggerKind: spec.triggerKind,
    cronExpression: spec.cronExpression,
    intervalSeconds: spec.intervalSeconds,
    triggerTimezone: spec.triggerTimezone,
    bodyTemplate: spec.bodyTemplate,
    headersTemplate: spec.headersTemplate,
    lastFireAt: null,
    nextFireAt: null,
    fireInProgress: false,
    maxAttempts: spec.maxAttempts,
    overallDeadlineMs: spec.overallDeadlineMs,
    status: spec.pattern === 'paused' ? 'paused' : 'active',
    createdAt: workspaceCreatedAt,
    updatedAt: workspaceCreatedAt,
  }
}
