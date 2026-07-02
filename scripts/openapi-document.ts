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
  DashboardSummarySchema,
  NeedsAttentionRowSchema,
  RecentFailureRowSchema,
  RunsDailyBucketSchema,
  SparklinesSchema,
  StatsSchema,
  UpcomingFireRowSchema,
} from '../src/shared/schemas/dashboard'
import {
  DirectoryRecipientSchema,
  DirectorySearchInput,
  DirectorySearchResult,
} from '../src/shared/schemas/directory'
import {
  JobCreateInput,
  JobSchema,
  JobSummarySchema,
  JobUpdateInput,
} from '../src/shared/schemas/job'
import {
  JobTemplateCreateInput,
  JobTemplateSaveFromJobInput,
  JobTemplateSchema,
  JobTemplateUpdateInput,
} from '../src/shared/schemas/job-template'
import { FieldErrorsSchema, MutationFailureSchema } from '../src/shared/schemas/mutation-result'
import { PurgeInput } from '../src/shared/schemas/recycle-bin'
import {
  AlertRuleSlugPairInput,
  ChannelSlugPairInput,
  IdInput,
  IncludeArchivedInput,
  JobSlugPairInput,
  OptionalWorkspaceScopeInput,
  SlugInput,
  TargetSlugPairInput,
  WorkspaceSlugInput,
} from '../src/shared/schemas/resource-refs'
import {
  AttemptBodyPreviewInput,
  AttemptDetailSchema,
  AttemptSummarySchema,
  RedactedHeadersSchema,
  RunDetailResponseSchema,
  RunRef,
  RunSchema,
  RunSummaryRowSchema,
  RunsForJobInput,
  RunsListResponseSchema,
  TriggerSourceSchema,
} from '../src/shared/schemas/run'
import { RunsSearchSchema } from '../src/shared/schemas/run-filters'
import { ProposeScheduleInput } from '../src/shared/schemas/schedule'
import {
  TargetCreateInput,
  TargetIdInput,
  TargetSchema,
  TargetUpdateInput,
} from '../src/shared/schemas/target'
import {
  TunnelCreateInput,
  TunnelIdInput,
  TunnelMoveTargetsInput,
  TunnelSchema,
  TunnelUpdateInput,
  TunnelVerifyResultSchema,
} from '../src/shared/schemas/tunnel'
import {
  RotateInputSchema,
  WebhookSecretCreatedResponseSchema,
  WebhookSecretSummarySchema,
  WebhookSecretsStateSchema,
} from '../src/shared/schemas/webhook-secret'
import {
  WorkspaceCreateInput,
  WorkspaceSchema,
  WorkspaceUpdateInput,
} from '../src/shared/schemas/workspace'
import {
  SecretCreateInputSchema,
  SecretRevealedResponseSchema,
  SecretRotateInputSchema,
  SecretSummarySchema,
  WorkspaceSecretRef,
} from '../src/shared/schemas/workspace-secret'
import { VariableMapSchema } from '../src/shared/schemas/workspace-variables'

export const document = createDocument({
  openapi: '3.1.0',
  info: {
    title: 'boop',
    version: pkg.version,
    description:
      'Generated from Zod schemas; the single source of truth for the boop API contract. ' +
      'This document is a schema catalog for the server-function (RPC) surface; ' +
      'operations are not modeled as OpenAPI paths.',
  },
  paths: {},
  components: {
    schemas: {
      User: UserSchema,
      Workspace: WorkspaceSchema,
      WorkspaceCreateInput,
      WorkspaceUpdateInput,
      Target: TargetSchema,
      TargetCreateInput,
      TargetUpdateInput,
      Tunnel: TunnelSchema,
      TunnelCreateInput,
      TunnelVerifyResult: TunnelVerifyResultSchema,
      Job: JobSchema,
      JobSummary: JobSummarySchema,
      JobCreateInput,
      JobUpdateInput,
      JobTemplate: JobTemplateSchema,
      JobTemplateCreateInput,
      JobTemplateUpdateInput,
      JobTemplateSaveFromJobInput,
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
      DirectoryRecipient: DirectoryRecipientSchema,
      DirectorySearchInput,
      DirectorySearchResult,
      VariableMap: VariableMapSchema,
      WorkspaceSecretSummary: SecretSummarySchema,
      WorkspaceSecretCreateInput: SecretCreateInputSchema,
      WorkspaceSecretRotateInput: SecretRotateInputSchema,
      WorkspaceSecretRevealedResponse: SecretRevealedResponseSchema,
      WorkspaceSecretRef,
      // Server-function routing + input schemas (ADR-013). Every validated
      // server-fn input is a named schema here so it enters the contract.
      SlugInput,
      IdInput,
      WorkspaceSlugInput,
      IncludeArchivedInput,
      OptionalWorkspaceScopeInput,
      TargetSlugPairInput,
      ChannelSlugPairInput,
      AlertRuleSlugPairInput,
      JobSlugPairInput,
      TargetIdInput,
      TunnelIdInput,
      TunnelUpdateInput,
      TunnelMoveTargetsInput,
      RunsSearchInput: RunsSearchSchema,
      RunsForJobInput,
      RunRef,
      AttemptBodyPreviewInput,
      ProposeScheduleInput,
      PurgeInput,
      FieldErrors: FieldErrorsSchema,
      MutationFailure: MutationFailureSchema,
    },
  },
})

export const serialized = `${JSON.stringify(document, null, 2)}\n`
