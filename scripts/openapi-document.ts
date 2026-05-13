import { createDocument } from 'zod-openapi'
import pkg from '../package.json' with { type: 'json' }
import { AlertContextSchema } from '../src/shared/schemas/alert-context'
import {
  AlertRuleConfigSchema,
  AlertRuleCreateInput,
  AlertRuleSchema,
  AlertRuleUpdateInput,
} from '../src/shared/schemas/alert-rule'
import { UserSchema } from '../src/shared/schemas/auth'
import {
  ChannelConfigSchema,
  ChannelCreateInput,
  ChannelSchema,
  ChannelUpdateInput,
} from '../src/shared/schemas/channel'
import {
  CustomerCreateInput,
  CustomerSchema,
  CustomerUpdateInput,
} from '../src/shared/schemas/customer'
import {
  SecretCreateInputSchema,
  SecretRevealedResponseSchema,
  SecretRotateInputSchema,
  SecretSummarySchema,
} from '../src/shared/schemas/customer-secret'
import { VariableMapSchema } from '../src/shared/schemas/customer-variables'
import {
  DashboardSummarySchema,
  NeedsAttentionRowSchema,
  RecentFailureRowSchema,
  RunsDailyBucketSchema,
  SparklinesSchema,
  StatsSchema,
  UpcomingFireRowSchema,
} from '../src/shared/schemas/dashboard'
import {
  JobCreateInput,
  JobSchema,
  JobSummarySchema,
  JobUpdateInput,
} from '../src/shared/schemas/job'
import {
  AttemptDetailSchema,
  AttemptSummarySchema,
  RedactedHeadersSchema,
  RunDetailResponseSchema,
  RunSchema,
  RunSummaryRowSchema,
  RunsListResponseSchema,
  TriggerSourceSchema,
} from '../src/shared/schemas/run'
import { TargetCreateInput, TargetSchema, TargetUpdateInput } from '../src/shared/schemas/target'
import {
  RotateInputSchema,
  WebhookSecretCreatedResponseSchema,
  WebhookSecretSummarySchema,
  WebhookSecretsStateSchema,
} from '../src/shared/schemas/webhook-secret'

export const document = createDocument({
  openapi: '3.1.0',
  info: {
    title: 'boop',
    version: pkg.version,
    description:
      'Generated from Zod schemas. Single source of truth for the API contract. ' +
      'The template ships no endpoints; add paths here as your app grows.',
  },
  paths: {},
  components: {
    schemas: {
      User: UserSchema,
      Customer: CustomerSchema,
      CustomerCreateInput,
      CustomerUpdateInput,
      Target: TargetSchema,
      TargetCreateInput,
      TargetUpdateInput,
      Job: JobSchema,
      JobSummary: JobSummarySchema,
      JobCreateInput,
      JobUpdateInput,
      Run: RunSchema,
      AttemptSummary: AttemptSummarySchema,
      AttemptDetail: AttemptDetailSchema,
      TriggerSource: TriggerSourceSchema,
      RedactedHeaders: RedactedHeadersSchema,
      RunDetailResponse: RunDetailResponseSchema,
      RunSummaryRow: RunSummaryRowSchema,
      RunsListResponse: RunsListResponseSchema,
      WebhookSecretSummary: WebhookSecretSummarySchema,
      WebhookSecretCreatedResponse: WebhookSecretCreatedResponseSchema,
      WebhookSecretsState: WebhookSecretsStateSchema,
      WebhookSecretRotateInput: RotateInputSchema,
      DashboardStats: StatsSchema,
      DashboardSparklines: SparklinesSchema,
      RunsDailyBucket: RunsDailyBucketSchema,
      NeedsAttentionRow: NeedsAttentionRowSchema,
      UpcomingFireRow: UpcomingFireRowSchema,
      RecentFailureRow: RecentFailureRowSchema,
      DashboardSummary: DashboardSummarySchema,
      ChannelConfig: ChannelConfigSchema,
      Channel: ChannelSchema,
      ChannelCreateInput,
      ChannelUpdateInput,
      AlertRuleConfig: AlertRuleConfigSchema,
      AlertRule: AlertRuleSchema,
      AlertRuleCreateInput,
      AlertRuleUpdateInput,
      AlertContext: AlertContextSchema,
      VariableMap: VariableMapSchema,
      CustomerSecretSummary: SecretSummarySchema,
      CustomerSecretCreateInput: SecretCreateInputSchema,
      CustomerSecretRotateInput: SecretRotateInputSchema,
      CustomerSecretRevealedResponse: SecretRevealedResponseSchema,
    },
  },
})

export const serialized = `${JSON.stringify(document, null, 2)}\n`
