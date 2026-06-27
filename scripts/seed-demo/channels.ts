import type { InferInsertModel } from 'drizzle-orm'
import type { channels } from '@/lib/db/schema'
import { demoId } from './ids'

type ChannelKind = 'teams' | 'email' | 'webhook'

export type DemoChannelSpec = {
  workspaceSlug: string
  slug: string
  name: string
  kind: ChannelKind
  config: Record<string, unknown>
}

export const DEMO_CHANNELS: readonly DemoChannelSpec[] = [
  // Desert Vista (critical) — Teams + PagerDuty-via-webhook + email
  {
    workspaceSlug: 'desert-vista-cu',
    slug: 'ops-teams',
    name: 'Desert Vista Ops Teams',
    kind: 'teams',
    config: {
      webhook_url: 'https://outlook.office.com/webhook/demo_only_desert_vista_ops',
    },
  },
  {
    workspaceSlug: 'desert-vista-cu',
    slug: 'pagerduty-critical',
    name: 'Desert Vista PagerDuty (critical)',
    kind: 'webhook',
    config: {
      url: 'https://events.pagerduty.com/v2/enqueue',
      method: 'POST',
      headers: { authorization: 'Token token=demo_only_pd_routing_key' },
      body_template: '{{ alert_context_json }}',
    },
  },
  {
    workspaceSlug: 'desert-vista-cu',
    slug: 'compliance-email',
    name: 'Compliance Email',
    kind: 'email',
    config: {
      recipients: ['compliance@desertvistacu.example'],
      subject_template: '[boop] {{ workspace_name }} - {{ job_name }} {{ outcome }}',
      body_template:
        'Job {{ job_name }} ({{ workspace_name }}) {{ outcome }}.\n\nRun: {{ run_url }}',
    },
  },

  // Cactus Title — Teams + email
  {
    workspaceSlug: 'cactus-title',
    slug: 'ops-teams',
    name: 'Cactus Title Ops Teams',
    kind: 'teams',
    config: { webhook_url: 'https://outlook.office.com/webhook/demo_only_cactus_title_ops' },
  },
  {
    workspaceSlug: 'cactus-title',
    slug: 'closings-email',
    name: 'Closings Email',
    kind: 'email',
    config: {
      recipients: ['closings@cactustitle.example'],
      subject_template: '[boop] {{ workspace_name }} - {{ job_name }} {{ outcome }}',
      body_template: 'Job {{ job_name }} ({{ outcome }}).',
    },
  },

  // Sun Valley Insurance — Teams + Autotask-via-webhook
  {
    workspaceSlug: 'sun-valley-insurance',
    slug: 'ops-teams',
    name: 'Sun Valley Ops Teams',
    kind: 'teams',
    config: { webhook_url: 'https://outlook.office.com/webhook/demo_only_sun_valley_ops' },
  },
  {
    workspaceSlug: 'sun-valley-insurance',
    slug: 'autotask-webhook',
    name: 'Sun Valley Autotask Bridge',
    kind: 'webhook',
    config: {
      url: 'https://webservices.autotask.net/atservices/1.6/atws.asmx',
      method: 'POST',
      headers: { 'content-type': 'text/xml; charset=utf-8' },
      body_template: '{{ alert_context_json }}',
    },
  },

  // Phoenix Healthcare — Teams + PagerDuty-critical
  {
    workspaceSlug: 'phoenix-healthcare-partners',
    slug: 'ops-teams',
    name: 'Phoenix Healthcare Ops Teams',
    kind: 'teams',
    config: { webhook_url: 'https://outlook.office.com/webhook/demo_only_phoenix_hc_ops' },
  },
  {
    workspaceSlug: 'phoenix-healthcare-partners',
    slug: 'pagerduty-critical',
    name: 'Phoenix Healthcare PagerDuty',
    kind: 'webhook',
    config: {
      url: 'https://events.pagerduty.com/v2/enqueue',
      method: 'POST',
      headers: { authorization: 'Token token=demo_only_pd_routing_key' },
      body_template: '{{ alert_context_json }}',
    },
  },

  // Mesa Manufacturing — Teams
  {
    workspaceSlug: 'mesa-manufacturing',
    slug: 'shop-teams',
    name: 'Mesa Shop Floor Teams',
    kind: 'teams',
    config: { webhook_url: 'https://outlook.office.com/webhook/demo_only_mesa_shop' },
  },

  // Salt River Logistics — Teams
  {
    workspaceSlug: 'salt-river-logistics',
    slug: 'ops-teams',
    name: 'Salt River Ops Teams',
    kind: 'teams',
    config: { webhook_url: 'https://outlook.office.com/webhook/demo_only_salt_river_ops' },
  },

  // Tempe Tech Group — Teams + email
  {
    workspaceSlug: 'tempe-tech-group',
    slug: 'ops-teams',
    name: 'Tempe Tech Ops Teams',
    kind: 'teams',
    config: { webhook_url: 'https://outlook.office.com/webhook/demo_only_tempe_tech_ops' },
  },
  {
    workspaceSlug: 'tempe-tech-group',
    slug: 'billing-email',
    name: 'Billing Email',
    kind: 'email',
    config: {
      recipients: ['billing@tempetech.example'],
      subject_template: '[boop] {{ workspace_name }} - {{ job_name }} {{ outcome }}',
      body_template: 'Job {{ job_name }} ({{ outcome }}).',
    },
  },

  // Skyline Realty Trust — Teams
  {
    workspaceSlug: 'skyline-realty-trust',
    slug: 'ops-teams',
    name: 'Skyline Ops Teams',
    kind: 'teams',
    config: { webhook_url: 'https://outlook.office.com/webhook/demo_only_skyline_ops' },
  },

  // SwitchThink (internal) — Teams + PagerDuty + email
  {
    workspaceSlug: 'switchthink',
    slug: 'internal-teams',
    name: 'SwitchThink Internal Teams',
    kind: 'teams',
    config: { webhook_url: 'https://outlook.office.com/webhook/demo_only_switchthink_internal' },
  },
  {
    workspaceSlug: 'switchthink',
    slug: 'pagerduty-critical',
    name: 'SwitchThink PagerDuty (critical)',
    kind: 'webhook',
    config: {
      url: 'https://events.pagerduty.com/v2/enqueue',
      method: 'POST',
      headers: { authorization: 'Token token=demo_only_pd_routing_key' },
      body_template: '{{ alert_context_json }}',
    },
  },
  {
    workspaceSlug: 'switchthink',
    slug: 'oncall-email',
    name: 'On-call Email',
    kind: 'email',
    config: {
      recipients: ['oncall@switchthink.com'],
      subject_template: '[boop] {{ workspace_name }} - {{ job_name }} {{ outcome }}',
      body_template: 'Run: {{ run_url }}',
    },
  },
]

type ChannelInsert = InferInsertModel<typeof channels>

export function channelRow(
  spec: DemoChannelSpec,
  workspaceId: string,
  workspaceCreatedAt: Date,
): ChannelInsert {
  return {
    id: demoId('chn', spec.workspaceSlug, spec.slug),
    workspaceId,
    kind: spec.kind,
    name: spec.name,
    slug: spec.slug,
    config: JSON.stringify(spec.config),
    status: 'active',
    lastUsedAt: null,
    lastTestAlertAt: null,
    lastTestAlertStatus: null,
    lastTestAlertReason: null,
    createdAt: workspaceCreatedAt,
    updatedAt: workspaceCreatedAt,
  }
}
