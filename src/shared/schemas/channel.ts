import { nameField, slugField } from './fields'
import { z } from './openapi'

export const CHANNEL_KINDS = ['teams', 'email', 'webhook'] as const
export type ChannelKind = (typeof CHANNEL_KINDS)[number]

export const WEBHOOK_METHODS = ['POST', 'PUT'] as const
export const TEST_ALERT_STATUSES = ['pending', 'delivered', 'failed'] as const

export const EMAIL_DEFAULT_SUBJECT = '[boop] {{ customer_name }} - {{ job_name }} {{ outcome }}'
export const EMAIL_DEFAULT_BODY = [
  'Job {{ job_name }} ({{ customer_name }}) {{ outcome }}.',
  '',
  'Started: {{ started_at }}',
  'Completed: {{ completed_at }}',
  'Duration: {{ duration_ms }}ms',
  'Attempts: {{ attempt_count }}',
  '',
  'Run details: {{ run_url }}',
].join('\n')
export const WEBHOOK_DEFAULT_BODY = '{{ alert_context_json }}'

const teamsConfig = z
  .object({
    kind: z.literal('teams'),
    webhook_url: z.url('Must be a valid URL'),
  })
  .meta({ id: 'ChannelConfigTeams' })

const emailConfig = z
  .object({
    kind: z.literal('email'),
    recipients: z
      .array(z.email('Must be a valid email'))
      .min(1, 'At least one recipient is required'),
    subject_template: z.string().min(1).max(500).default(EMAIL_DEFAULT_SUBJECT),
    body_template: z.string().min(1).max(8000).default(EMAIL_DEFAULT_BODY),
  })
  .meta({ id: 'ChannelConfigEmail' })

const webhookConfig = z
  .object({
    kind: z.literal('webhook'),
    url: z.url('Must be a valid URL'),
    method: z.enum(WEBHOOK_METHODS).default('POST'),
    headers: z.record(z.string(), z.string()).default({}),
    body_template: z.string().min(1).max(8000).default(WEBHOOK_DEFAULT_BODY),
  })
  .meta({ id: 'ChannelConfigWebhook' })

export const ChannelConfigSchema = z
  .discriminatedUnion('kind', [teamsConfig, emailConfig, webhookConfig])
  .meta({ id: 'ChannelConfig' })

export type ChannelConfig = z.infer<typeof ChannelConfigSchema>

export const ChannelSchema = z
  .object({
    id: z.string().meta({ example: 'chn_abc123' }),
    customerId: z.string().meta({ example: 'cust_abc123' }),
    kind: z.enum(CHANNEL_KINDS),
    name: z.string().meta({ example: 'SwitchThink ops Teams' }),
    slug: z.string().meta({ example: 'switchthink-ops-teams' }),
    config: ChannelConfigSchema,
    status: z.enum(['active', 'archived']),
    lastUsedAt: z.iso.datetime().nullable(),
    lastTestAlertAt: z.iso.datetime().nullable(),
    lastTestAlertStatus: z.enum(TEST_ALERT_STATUSES).nullable(),
    lastTestAlertReason: z.string().nullable(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .meta({
    id: 'Channel',
    description: 'A reusable outbound destination for alerts, owned by a Customer.',
  })

export type Channel = z.infer<typeof ChannelSchema>

const channelMutableFields = {
  name: nameField,
  config: ChannelConfigSchema,
}

export const ChannelCreateInput = z
  .object({ ...channelMutableFields, slug: slugField })
  .meta({ id: 'ChannelCreateInput' })

export type ChannelCreateInput = z.infer<typeof ChannelCreateInput>

export const ChannelUpdateInput = z.object(channelMutableFields).meta({ id: 'ChannelUpdateInput' })

export type ChannelUpdateInput = z.infer<typeof ChannelUpdateInput>
