import { sql } from 'drizzle-orm'
import { check, index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { enumColumn, lifecycleCheck, timestamps } from './columns'

const LIFECYCLE_STATUSES = ['active', 'archived'] as const
export const USER_ROLES = ['admin', 'operator'] as const
export type UserRole = (typeof USER_ROLES)[number]
const TARGET_REACHABILITIES = ['public', 'tunnel'] as const
const TARGET_AUTH_KINDS = ['none', 'bearer', 'basic', 'header'] as const
const JOB_STATUSES = ['active', 'paused', 'archived'] as const
const TRIGGER_KINDS = ['cron', 'interval', 'webhook', 'manual'] as const
const RUN_STATUSES = ['scheduled', 'running', 'completed', 'canceled'] as const
const RUN_OUTCOMES = ['success', 'failure', 'timeout'] as const
const FAILURE_KINDS = [
  'timeout',
  'network',
  'http_4xx',
  'http_5xx',
  'non_2xx_other',
  'tunnel_credential_missing',
] as const
const CHANNEL_KINDS = ['teams', 'pagerduty', 'autotask', 'email', 'webhook'] as const
const ALERT_RULE_KINDS = [
  'first_failure',
  'consecutive_failures',
  'recovery',
  'slow_run',
  'missed_schedule',
] as const
const ALERT_RULE_SCOPES = ['workspace', 'job'] as const
const AUTHORING_SESSION_STATES = ['draft', 'confirmed', 'abandoned'] as const
const TUNNEL_CONNECTOR_STATUSES = ['healthy', 'degraded', 'down', 'inactive'] as const
const TUNNEL_VERIFY_OUTCOMES = ['ok', 'unauthorized', 'forbidden', 'network', 'unknown'] as const
const JOB_TEMPLATE_TAGS = [
  'backups',
  'health-checks',
  'reports',
  'integrations',
  'maintenance',
  'custom',
] as const

export const workspaces = sqliteTable(
  'workspaces',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    timezone: text('timezone').notNull(),
    autotaskCompanyId: text('autotask_company_id'),
    status: enumColumn('status', LIFECYCLE_STATUSES).notNull().default('active'),
    variables: text('variables', { mode: 'json' })
      .$type<Record<string, string>>()
      .notNull()
      .default({}),
    seedTag: text('seed_tag'),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex('workspaces_slug_idx').on(table.slug),
    index('workspaces_status_idx').on(table.status),
    index('workspaces_seed_tag_idx').on(table.seedTag).where(sql`${table.seedTag} IS NOT NULL`),
    lifecycleCheck(table.status, LIFECYCLE_STATUSES),
  ],
)

export const users = sqliteTable(
  'users',
  {
    id: text('id').primaryKey(),
    email: text('email').notNull(),
    name: text('name'),
    image: text('image'),
    role: enumColumn('role', USER_ROLES).notNull().default('operator'),
    seedTag: text('seed_tag'),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex('users_email_idx').on(table.email),
    index('users_seed_tag_idx').on(table.seedTag).where(sql`${table.seedTag} IS NOT NULL`),
    lifecycleCheck(table.role, USER_ROLES),
  ],
)

// Cloudflare resource ids and Access service-token secret references for a
// provisioned Tunnel live here so the dispatcher and the decommission saga
// resolve them without another Cloudflare round-trip. A Tunnel is fronted by
// one or more Connectors. See ADR-028.
export const tunnels = sqliteTable(
  'tunnels',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'restrict' }),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    hostname: text('hostname').notNull(),
    cfTunnelId: text('cf_tunnel_id').notNull(),
    cfAccessAppId: text('cf_access_app_id').notNull(),
    cfAccessPolicyId: text('cf_access_policy_id').notNull(),
    cfServiceTokenId: text('cf_service_token_id').notNull(),
    cfDnsRecordId: text('cf_dns_record_id'),
    cfCertPackId: text('cf_cert_pack_id'),
    clientIdSecretName: text('client_id_secret_name').notNull(),
    clientSecretSecretName: text('client_secret_secret_name').notNull(),
    connectorStatus: enumColumn('connector_status', TUNNEL_CONNECTOR_STATUSES),
    connectorCheckedAt: integer('connector_checked_at', { mode: 'timestamp_ms' }),
    certStatus: text('cert_status'),
    lastVerifyOutcome: enumColumn('last_verify_outcome', TUNNEL_VERIFY_OUTCOMES),
    lastVerifiedAt: integer('last_verified_at', { mode: 'timestamp_ms' }),
    status: enumColumn('status', LIFECYCLE_STATUSES).notNull().default('active'),
    archivedAt: integer('archived_at', { mode: 'timestamp_ms' }),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex('tunnels_workspace_slug_idx').on(table.workspaceId, table.slug),
    uniqueIndex('tunnels_hostname_idx').on(table.hostname),
    uniqueIndex('tunnels_cf_tunnel_id_idx').on(table.cfTunnelId),
    index('tunnels_workspace_status_idx').on(table.workspaceId, table.status),
    lifecycleCheck(table.status, LIFECYCLE_STATUSES),
    lifecycleCheck(table.connectorStatus, TUNNEL_CONNECTOR_STATUSES),
    lifecycleCheck(table.lastVerifyOutcome, TUNNEL_VERIFY_OUTCOMES),
  ],
)

export const targets = sqliteTable(
  'targets',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'restrict' }),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    url: text('url').notNull(),
    method: text('method').notNull(),
    authKind: enumColumn('auth_kind', TARGET_AUTH_KINDS).notNull().default('none'),
    authConfig: text('auth_config'),
    reachability: enumColumn('reachability', TARGET_REACHABILITIES).notNull().default('public'),
    tunnelId: text('tunnel_id').references(() => tunnels.id, { onDelete: 'restrict' }),
    // Private (tunnel) targets only: the on-prem address the connector forwards to.
    internalOrigin: text('internal_origin'),
    // Private (tunnel) targets only: cloudflared originRequest overrides for the
    // origin (e.g. an IIS host-header binding, or an internal TLS cert name).
    originHostHeader: text('origin_host_header'),
    originServerName: text('origin_server_name'),
    originNoTlsVerify: integer('origin_no_tls_verify', { mode: 'boolean' })
      .notNull()
      .default(false),
    status: enumColumn('status', LIFECYCLE_STATUSES).notNull().default('active'),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex('targets_workspace_slug_idx').on(table.workspaceId, table.slug),
    index('targets_workspace_status_idx').on(table.workspaceId, table.status),
    index('targets_tunnel_idx').on(table.tunnelId),
    lifecycleCheck(table.status, LIFECYCLE_STATUSES),
    lifecycleCheck(table.reachability, TARGET_REACHABILITIES),
    lifecycleCheck(table.authKind, TARGET_AUTH_KINDS),
  ],
)

export const jobs = sqliteTable(
  'jobs',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'restrict' }),
    targetId: text('target_id')
      .notNull()
      .references(() => targets.id, { onDelete: 'restrict' }),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    triggerKind: enumColumn('trigger_kind', TRIGGER_KINDS).notNull(),
    cronExpression: text('cron_expression'),
    intervalSeconds: integer('interval_seconds'),
    triggerTimezone: text('trigger_timezone'),
    bodyTemplate: text('body_template').notNull().default(''),
    headersTemplate: text('headers_template').notNull().default('{}'),
    variables: text('variables', { mode: 'json' })
      .$type<Record<string, string>>()
      .notNull()
      .default({}),
    lastFireAt: integer('last_fire_at', { mode: 'timestamp_ms' }),
    lastMissedAlertAt: integer('last_missed_alert_at', { mode: 'timestamp_ms' }),
    nextFireAt: integer('next_fire_at', { mode: 'timestamp_ms' }),
    fireInProgress: integer('fire_in_progress', { mode: 'boolean' }).notNull().default(false),
    maxAttempts: integer('max_attempts').notNull().default(3),
    overallDeadlineMs: integer('overall_deadline_ms').notNull().default(60_000),
    status: enumColumn('status', JOB_STATUSES).notNull().default('active'),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex('jobs_workspace_slug_idx').on(table.workspaceId, table.slug),
    index('jobs_workspace_status_idx').on(table.workspaceId, table.status),
    index('jobs_status_next_fire_idx').on(table.status, table.nextFireAt),
    index('jobs_target_idx').on(table.targetId),
    lifecycleCheck(table.status, JOB_STATUSES),
    lifecycleCheck(table.triggerKind, TRIGGER_KINDS),
  ],
)

// A built-in template is a product-shipped seed (no owning Workspace);
// every other template belongs to exactly one Workspace.
export const jobTemplates = sqliteTable(
  'job_templates',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    workspaceId: text('workspace_id').references(() => workspaces.id, { onDelete: 'cascade' }),
    tag: enumColumn('tag', JOB_TEMPLATE_TAGS).notNull().default('custom'),
    icon: text('icon'),
    description: text('description'),
    triggerKind: enumColumn('trigger_kind', TRIGGER_KINDS).notNull(),
    triggerConfig: text('trigger_config', { mode: 'json' })
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    targetRef: text('target_ref').notNull(),
    bodyTemplate: text('body_template').notNull().default(''),
    headersTemplate: text('headers_template').notNull().default('{}'),
    variables: text('variables', { mode: 'json' })
      .$type<Record<string, string>>()
      .notNull()
      .default({}),
    maxAttempts: integer('max_attempts').notNull().default(3),
    overallDeadlineMs: integer('overall_deadline_ms').notNull().default(60_000),
    builtIn: integer('built_in', { mode: 'boolean' }).notNull().default(false),
    status: enumColumn('status', LIFECYCLE_STATUSES).notNull().default('active'),
    archivedAt: integer('archived_at', { mode: 'timestamp_ms' }),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex('job_templates_builtin_slug_idx')
      .on(table.slug)
      .where(sql`${table.workspaceId} IS NULL AND ${table.status} = 'active'`),
    uniqueIndex('job_templates_workspace_slug_idx')
      .on(table.workspaceId, table.slug)
      .where(sql`${table.workspaceId} IS NOT NULL AND ${table.status} = 'active'`),
    index('job_templates_tag_idx').on(table.tag).where(sql`${table.status} = 'active'`),
    index('job_templates_workspace_status_idx').on(table.workspaceId, table.status),
    check(
      'job_templates_builtin_owner_check',
      sql`(${table.builtIn} = 1 AND ${table.workspaceId} IS NULL)
        OR (${table.builtIn} = 0 AND ${table.workspaceId} IS NOT NULL)`,
    ),
    lifecycleCheck(table.status, LIFECYCLE_STATUSES),
    lifecycleCheck(table.tag, JOB_TEMPLATE_TAGS),
    lifecycleCheck(table.triggerKind, TRIGGER_KINDS),
  ],
)

// runs and attempts are high-volume; status/outcome/failure_kind are
// enforced at the Zod boundary, not via CHECK, so adding an enum value
// later does not trigger a SQLite table rebuild.
export const runs = sqliteTable(
  'runs',
  {
    id: text('id').primaryKey(),
    jobId: text('job_id')
      .notNull()
      .references(() => jobs.id, { onDelete: 'cascade' }),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'restrict' }),
    scheduledAt: integer('scheduled_at', { mode: 'timestamp_ms' }).notNull(),
    startedAt: integer('started_at', { mode: 'timestamp_ms' }),
    completedAt: integer('completed_at', { mode: 'timestamp_ms' }),
    status: enumColumn('status', RUN_STATUSES).notNull().default('scheduled'),
    outcome: enumColumn('outcome', RUN_OUTCOMES),
    triggerSource: text('trigger_source').notNull().default('cron'),
    skippedReason: text('skipped_reason'),
    ...timestamps(),
  },
  (table) => [
    index('runs_job_started_idx').on(table.jobId, sql`${table.startedAt} desc`),
    index('runs_workspace_started_idx').on(table.workspaceId, sql`${table.startedAt} desc`),
  ],
)

export const attempts = sqliteTable(
  'attempts',
  {
    id: text('id').primaryKey(),
    runId: text('run_id')
      .notNull()
      .references(() => runs.id, { onDelete: 'cascade' }),
    attemptNumber: integer('attempt_number').notNull(),
    startedAt: integer('started_at', { mode: 'timestamp_ms' }).notNull(),
    completedAt: integer('completed_at', { mode: 'timestamp_ms' }),
    httpStatus: integer('http_status'),
    failureKind: enumColumn('failure_kind', FAILURE_KINDS),
    requestBodyR2Key: text('request_body_r2_key'),
    responseBodyR2Key: text('response_body_r2_key'),
    requestHeadersJson: text('request_headers_json'),
    ...timestamps(),
  },
  (table) => [uniqueIndex('attempts_run_idx').on(table.runId, table.attemptNumber)],
)

const TEST_ALERT_STATUSES = ['pending', 'delivered', 'failed'] as const

export const channels = sqliteTable(
  'channels',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    kind: enumColumn('kind', CHANNEL_KINDS).notNull(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    config: text('config').notNull().default('{}'),
    status: enumColumn('status', LIFECYCLE_STATUSES).notNull().default('active'),
    lastUsedAt: integer('last_used_at', { mode: 'timestamp_ms' }),
    lastTestAlertAt: integer('last_test_alert_at', { mode: 'timestamp_ms' }),
    lastTestAlertStatus: enumColumn('last_test_alert_status', TEST_ALERT_STATUSES),
    lastTestAlertReason: text('last_test_alert_reason'),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex('channels_workspace_slug_idx').on(table.workspaceId, table.slug),
    index('channels_workspace_status_idx').on(table.workspaceId, table.status),
    lifecycleCheck(table.status, LIFECYCLE_STATUSES),
    lifecycleCheck(table.kind, CHANNEL_KINDS),
  ],
)

export const alertRules = sqliteTable(
  'alert_rules',
  {
    id: text('id').primaryKey(),
    scope: enumColumn('scope', ALERT_RULE_SCOPES).notNull().default('workspace'),
    workspaceId: text('workspace_id').references(() => workspaces.id, { onDelete: 'cascade' }),
    jobId: text('job_id').references(() => jobs.id, { onDelete: 'cascade' }),
    kind: enumColumn('kind', ALERT_RULE_KINDS).notNull(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    config: text('config').notNull().default('{}'),
    channelIds: text('channel_ids').notNull().default('[]'),
    status: enumColumn('status', LIFECYCLE_STATUSES).notNull().default('active'),
    lastFiredAt: integer('last_fired_at', { mode: 'timestamp_ms' }),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex('alert_rules_workspace_slug_idx')
      .on(table.workspaceId, table.slug)
      .where(sql`${table.scope} = 'workspace'`),
    uniqueIndex('alert_rules_job_slug_idx')
      .on(table.jobId, table.slug)
      .where(sql`${table.scope} = 'job'`),
    index('alert_rules_workspace_status_idx').on(table.workspaceId, table.status),
    index('alert_rules_job_idx').on(table.jobId),
    index('alert_rules_scope_status_idx').on(table.scope, table.status),
    check(
      'alert_rules_scope_owner_check',
      sql`(${table.scope} = 'workspace' AND ${table.workspaceId} IS NOT NULL AND ${table.jobId} IS NULL)
        OR (${table.scope} = 'job' AND ${table.jobId} IS NOT NULL AND ${table.workspaceId} IS NULL)`,
    ),
    lifecycleCheck(table.status, LIFECYCLE_STATUSES),
    lifecycleCheck(table.kind, ALERT_RULE_KINDS),
    lifecycleCheck(table.scope, ALERT_RULE_SCOPES),
  ],
)

// Stored plaintext: HMAC verification of inbound webhooks requires the
// same key the caller signed with, so a one-way hash is incompatible with
// the scheme. Envelope encryption with a Wrangler master key is the
// queued hardening.
export const webhookSecrets = sqliteTable(
  'webhook_secrets',
  {
    id: text('id').primaryKey(),
    jobId: text('job_id')
      .notNull()
      .references(() => jobs.id, { onDelete: 'cascade' }),
    secret: text('secret').notNull(),
    revokedAt: integer('revoked_at', { mode: 'timestamp_ms' }),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }),
    ...timestamps(),
  },
  (table) => [index('webhook_secrets_job_active_idx').on(table.jobId, table.revokedAt)],
)

export const authoringSessions = sqliteTable(
  'authoring_sessions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    workspaceId: text('workspace_id').references(() => workspaces.id, {
      onDelete: 'set null',
    }),
    messages: text('messages').notNull().default('[]'),
    state: enumColumn('state', AUTHORING_SESSION_STATES).notNull().default('draft'),
    ...timestamps(),
  },
  (table) => [
    index('authoring_sessions_user_state_idx').on(table.userId, table.state),
    index('authoring_sessions_workspace_idx').on(table.workspaceId),
    lifecycleCheck(table.state, AUTHORING_SESSION_STATES),
  ],
)

export const workspaceSecrets = sqliteTable(
  'workspace_secrets',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    valueHash: text('value_hash').notNull(),
    valueCiphertext: text('value_ciphertext').notNull(),
    valueIv: text('value_iv').notNull(),
    revokedAt: integer('revoked_at', { mode: 'timestamp_ms' }),
    lastUsedAt: integer('last_used_at', { mode: 'timestamp_ms' }),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex('workspace_secrets_active_name_idx')
      .on(table.workspaceId, table.name)
      .where(sql`${table.revokedAt} IS NULL`),
    index('workspace_secrets_workspace_idx').on(table.workspaceId),
  ],
)
