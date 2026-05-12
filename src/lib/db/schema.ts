import { sql } from 'drizzle-orm'
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { enumColumn, lifecycleCheck, timestamps } from './columns'

const LIFECYCLE_STATUSES = ['active', 'archived'] as const
export const USER_ROLES = ['admin', 'operator'] as const
export type UserRole = (typeof USER_ROLES)[number]
const TARGET_REACHABILITIES = ['public', 'tunnel'] as const
const TARGET_AUTH_KINDS = ['none', 'bearer', 'basic', 'header'] as const
const JOB_STATUSES = ['active', 'paused', 'archived'] as const
const TRIGGER_KINDS = ['cron', 'interval', 'webhook'] as const
const RUN_STATUSES = ['scheduled', 'running', 'completed', 'canceled'] as const
const RUN_OUTCOMES = ['success', 'failure', 'timeout'] as const
const FAILURE_KINDS = ['timeout', 'network', 'http_4xx', 'http_5xx', 'non_2xx_other'] as const
const CHANNEL_KINDS = ['teams', 'pagerduty', 'autotask', 'email', 'webhook'] as const
const ALERT_RULE_KINDS = ['first_failure', 'consecutive_failures', 'recovery', 'slow_run'] as const
const AUTHORING_SESSION_STATES = ['draft', 'confirmed', 'abandoned'] as const

export const customers = sqliteTable(
  'customers',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    timezone: text('timezone').notNull(),
    autotaskCompanyId: text('autotask_company_id'),
    status: enumColumn('status', LIFECYCLE_STATUSES).notNull().default('active'),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex('customers_slug_idx').on(table.slug),
    index('customers_status_idx').on(table.status),
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
    ...timestamps(),
  },
  (table) => [
    uniqueIndex('users_email_idx').on(table.email),
    lifecycleCheck(table.role, USER_ROLES),
  ],
)

export const targets = sqliteTable(
  'targets',
  {
    id: text('id').primaryKey(),
    customerId: text('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'restrict' }),
    name: text('name').notNull(),
    url: text('url').notNull(),
    method: text('method').notNull(),
    authKind: enumColumn('auth_kind', TARGET_AUTH_KINDS).notNull().default('none'),
    authConfig: text('auth_config'),
    reachability: enumColumn('reachability', TARGET_REACHABILITIES).notNull().default('public'),
    status: enumColumn('status', LIFECYCLE_STATUSES).notNull().default('active'),
    ...timestamps(),
  },
  (table) => [
    index('targets_customer_status_idx').on(table.customerId, table.status),
    lifecycleCheck(table.status, LIFECYCLE_STATUSES),
    lifecycleCheck(table.reachability, TARGET_REACHABILITIES),
    lifecycleCheck(table.authKind, TARGET_AUTH_KINDS),
  ],
)

export const jobs = sqliteTable(
  'jobs',
  {
    id: text('id').primaryKey(),
    customerId: text('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'restrict' }),
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
    lastFireAt: integer('last_fire_at', { mode: 'timestamp_ms' }),
    nextFireAt: integer('next_fire_at', { mode: 'timestamp_ms' }),
    fireInProgress: integer('fire_in_progress', { mode: 'boolean' }).notNull().default(false),
    status: enumColumn('status', JOB_STATUSES).notNull().default('active'),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex('jobs_customer_slug_idx').on(table.customerId, table.slug),
    index('jobs_customer_status_idx').on(table.customerId, table.status),
    index('jobs_status_next_fire_idx').on(table.status, table.nextFireAt),
    lifecycleCheck(table.status, JOB_STATUSES),
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
    customerId: text('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'restrict' }),
    scheduledAt: integer('scheduled_at', { mode: 'timestamp_ms' }).notNull(),
    startedAt: integer('started_at', { mode: 'timestamp_ms' }),
    completedAt: integer('completed_at', { mode: 'timestamp_ms' }),
    status: enumColumn('status', RUN_STATUSES).notNull().default('scheduled'),
    outcome: enumColumn('outcome', RUN_OUTCOMES),
    skippedReason: text('skipped_reason'),
    ...timestamps(),
  },
  (table) => [
    index('runs_job_started_idx').on(table.jobId, sql`${table.startedAt} desc`),
    index('runs_customer_started_idx').on(table.customerId, sql`${table.startedAt} desc`),
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
    ...timestamps(),
  },
  (table) => [uniqueIndex('attempts_run_idx').on(table.runId, table.attemptNumber)],
)

export const channels = sqliteTable(
  'channels',
  {
    id: text('id').primaryKey(),
    customerId: text('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'cascade' }),
    kind: enumColumn('kind', CHANNEL_KINDS).notNull(),
    name: text('name').notNull(),
    config: text('config').notNull().default('{}'),
    status: enumColumn('status', LIFECYCLE_STATUSES).notNull().default('active'),
    ...timestamps(),
  },
  (table) => [
    index('channels_customer_status_idx').on(table.customerId, table.status),
    lifecycleCheck(table.status, LIFECYCLE_STATUSES),
    lifecycleCheck(table.kind, CHANNEL_KINDS),
  ],
)

export const alertRules = sqliteTable(
  'alert_rules',
  {
    id: text('id').primaryKey(),
    customerId: text('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'cascade' }),
    jobId: text('job_id').references(() => jobs.id, { onDelete: 'cascade' }),
    kind: enumColumn('kind', ALERT_RULE_KINDS).notNull(),
    config: text('config').notNull().default('{}'),
    channelIds: text('channel_ids').notNull().default('[]'),
    status: enumColumn('status', LIFECYCLE_STATUSES).notNull().default('active'),
    ...timestamps(),
  },
  (table) => [
    index('alert_rules_customer_status_idx').on(table.customerId, table.status),
    index('alert_rules_job_idx').on(table.jobId),
    lifecycleCheck(table.status, LIFECYCLE_STATUSES),
    lifecycleCheck(table.kind, ALERT_RULE_KINDS),
  ],
)

export const authoringSessions = sqliteTable(
  'authoring_sessions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    customerId: text('customer_id').references(() => customers.id, {
      onDelete: 'set null',
    }),
    messages: text('messages').notNull().default('[]'),
    state: enumColumn('state', AUTHORING_SESSION_STATES).notNull().default('draft'),
    ...timestamps(),
  },
  (table) => [
    index('authoring_sessions_user_state_idx').on(table.userId, table.state),
    lifecycleCheck(table.state, AUTHORING_SESSION_STATES),
  ],
)
