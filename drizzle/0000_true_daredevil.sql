CREATE TABLE `alert_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`scope` text DEFAULT 'workspace' NOT NULL,
	`workspace_id` text,
	`job_id` text,
	`kind` text NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`config` text DEFAULT '{}' NOT NULL,
	`channel_ids` text DEFAULT '[]' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`last_fired_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "alert_rules_scope_owner_check" CHECK(("alert_rules"."scope" = 'workspace' AND "alert_rules"."workspace_id" IS NOT NULL AND "alert_rules"."job_id" IS NULL)
        OR ("alert_rules"."scope" = 'job' AND "alert_rules"."job_id" IS NOT NULL AND "alert_rules"."workspace_id" IS NULL)),
	CONSTRAINT "status_check" CHECK("status" IN ('active', 'archived')),
	CONSTRAINT "kind_check" CHECK("kind" IN ('first_failure', 'consecutive_failures', 'recovery', 'slow_run', 'missed_schedule')),
	CONSTRAINT "scope_check" CHECK("scope" IN ('workspace', 'job'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `alert_rules_workspace_slug_idx` ON `alert_rules` (`workspace_id`,`slug`) WHERE "alert_rules"."scope" = 'workspace';--> statement-breakpoint
CREATE UNIQUE INDEX `alert_rules_job_slug_idx` ON `alert_rules` (`job_id`,`slug`) WHERE "alert_rules"."scope" = 'job';--> statement-breakpoint
CREATE INDEX `alert_rules_workspace_status_idx` ON `alert_rules` (`workspace_id`,`status`);--> statement-breakpoint
CREATE INDEX `alert_rules_job_idx` ON `alert_rules` (`job_id`);--> statement-breakpoint
CREATE INDEX `alert_rules_scope_status_idx` ON `alert_rules` (`scope`,`status`);--> statement-breakpoint
CREATE TABLE `attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`attempt_number` integer NOT NULL,
	`started_at` integer NOT NULL,
	`completed_at` integer,
	`http_status` integer,
	`failure_kind` text,
	`request_body_r2_key` text,
	`response_body_r2_key` text,
	`request_headers_json` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `runs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `attempts_run_idx` ON `attempts` (`run_id`,`attempt_number`);--> statement-breakpoint
CREATE TABLE `authoring_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`workspace_id` text,
	`messages` text DEFAULT '[]' NOT NULL,
	`state` text DEFAULT 'draft' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "state_check" CHECK("state" IN ('draft', 'confirmed', 'abandoned'))
);
--> statement-breakpoint
CREATE INDEX `authoring_sessions_user_state_idx` ON `authoring_sessions` (`user_id`,`state`);--> statement-breakpoint
CREATE TABLE `channels` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`kind` text NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`config` text DEFAULT '{}' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`last_used_at` integer,
	`last_test_alert_at` integer,
	`last_test_alert_status` text,
	`last_test_alert_reason` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "status_check" CHECK("status" IN ('active', 'archived')),
	CONSTRAINT "kind_check" CHECK("kind" IN ('teams', 'pagerduty', 'autotask', 'email', 'webhook'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `channels_workspace_slug_idx` ON `channels` (`workspace_id`,`slug`);--> statement-breakpoint
CREATE INDEX `channels_workspace_status_idx` ON `channels` (`workspace_id`,`status`);--> statement-breakpoint
CREATE TABLE `job_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`workspace_id` text,
	`tag` text DEFAULT 'custom' NOT NULL,
	`icon` text,
	`description` text,
	`trigger_kind` text NOT NULL,
	`trigger_config` text DEFAULT '{}' NOT NULL,
	`target_ref` text NOT NULL,
	`body_template` text DEFAULT '' NOT NULL,
	`headers_template` text DEFAULT '{}' NOT NULL,
	`variables` text DEFAULT '{}' NOT NULL,
	`max_attempts` integer DEFAULT 3 NOT NULL,
	`overall_deadline_ms` integer DEFAULT 60000 NOT NULL,
	`built_in` integer DEFAULT false NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`archived_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "job_templates_builtin_owner_check" CHECK(("job_templates"."built_in" = 1 AND "job_templates"."workspace_id" IS NULL)
        OR ("job_templates"."built_in" = 0 AND "job_templates"."workspace_id" IS NOT NULL)),
	CONSTRAINT "status_check" CHECK("status" IN ('active', 'archived')),
	CONSTRAINT "tag_check" CHECK("tag" IN ('backups', 'health-checks', 'reports', 'integrations', 'maintenance', 'custom')),
	CONSTRAINT "trigger_kind_check" CHECK("trigger_kind" IN ('cron', 'interval', 'webhook'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `job_templates_builtin_slug_idx` ON `job_templates` (`slug`) WHERE "job_templates"."workspace_id" IS NULL AND "job_templates"."status" = 'active';--> statement-breakpoint
CREATE UNIQUE INDEX `job_templates_workspace_slug_idx` ON `job_templates` (`workspace_id`,`slug`) WHERE "job_templates"."workspace_id" IS NOT NULL AND "job_templates"."status" = 'active';--> statement-breakpoint
CREATE INDEX `job_templates_tag_idx` ON `job_templates` (`tag`) WHERE "job_templates"."status" = 'active';--> statement-breakpoint
CREATE INDEX `job_templates_workspace_status_idx` ON `job_templates` (`workspace_id`,`status`);--> statement-breakpoint
CREATE TABLE `jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`target_id` text NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`trigger_kind` text NOT NULL,
	`cron_expression` text,
	`interval_seconds` integer,
	`trigger_timezone` text,
	`body_template` text DEFAULT '' NOT NULL,
	`headers_template` text DEFAULT '{}' NOT NULL,
	`variables` text DEFAULT '{}' NOT NULL,
	`last_fire_at` integer,
	`last_missed_alert_at` integer,
	`next_fire_at` integer,
	`fire_in_progress` integer DEFAULT false NOT NULL,
	`max_attempts` integer DEFAULT 3 NOT NULL,
	`overall_deadline_ms` integer DEFAULT 60000 NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`target_id`) REFERENCES `targets`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "status_check" CHECK("status" IN ('active', 'paused', 'archived')),
	CONSTRAINT "trigger_kind_check" CHECK("trigger_kind" IN ('cron', 'interval', 'webhook'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `jobs_workspace_slug_idx` ON `jobs` (`workspace_id`,`slug`);--> statement-breakpoint
CREATE INDEX `jobs_workspace_status_idx` ON `jobs` (`workspace_id`,`status`);--> statement-breakpoint
CREATE INDEX `jobs_status_next_fire_idx` ON `jobs` (`status`,`next_fire_at`);--> statement-breakpoint
CREATE TABLE `runs` (
	`id` text PRIMARY KEY NOT NULL,
	`job_id` text NOT NULL,
	`workspace_id` text NOT NULL,
	`scheduled_at` integer NOT NULL,
	`started_at` integer,
	`completed_at` integer,
	`status` text DEFAULT 'scheduled' NOT NULL,
	`outcome` text,
	`trigger_source` text DEFAULT 'cron' NOT NULL,
	`skipped_reason` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `runs_job_started_idx` ON `runs` (`job_id`,"started_at" desc);--> statement-breakpoint
CREATE INDEX `runs_workspace_started_idx` ON `runs` (`workspace_id`,"started_at" desc);--> statement-breakpoint
CREATE TABLE `targets` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`url` text NOT NULL,
	`method` text NOT NULL,
	`auth_kind` text DEFAULT 'none' NOT NULL,
	`auth_config` text,
	`reachability` text DEFAULT 'public' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "status_check" CHECK("status" IN ('active', 'archived')),
	CONSTRAINT "reachability_check" CHECK("reachability" IN ('public', 'tunnel')),
	CONSTRAINT "auth_kind_check" CHECK("auth_kind" IN ('none', 'bearer', 'basic', 'header'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `targets_workspace_slug_idx` ON `targets` (`workspace_id`,`slug`);--> statement-breakpoint
CREATE INDEX `targets_workspace_status_idx` ON `targets` (`workspace_id`,`status`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text,
	`image` text,
	`role` text DEFAULT 'operator' NOT NULL,
	`seed_tag` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	CONSTRAINT "role_check" CHECK("role" IN ('admin', 'operator'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_idx` ON `users` (`email`);--> statement-breakpoint
CREATE INDEX `users_seed_tag_idx` ON `users` (`seed_tag`) WHERE "users"."seed_tag" IS NOT NULL;--> statement-breakpoint
CREATE TABLE `webhook_secrets` (
	`id` text PRIMARY KEY NOT NULL,
	`job_id` text NOT NULL,
	`secret` text NOT NULL,
	`revoked_at` integer,
	`expires_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `webhook_secrets_job_active_idx` ON `webhook_secrets` (`job_id`,`revoked_at`);--> statement-breakpoint
CREATE TABLE `workspace_secrets` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`name` text NOT NULL,
	`value_hash` text NOT NULL,
	`value_ciphertext` text NOT NULL,
	`value_iv` text NOT NULL,
	`revoked_at` integer,
	`last_used_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `workspace_secrets_active_name_idx` ON `workspace_secrets` (`workspace_id`,`name`) WHERE "workspace_secrets"."revoked_at" IS NULL;--> statement-breakpoint
CREATE INDEX `workspace_secrets_workspace_idx` ON `workspace_secrets` (`workspace_id`);--> statement-breakpoint
CREATE TABLE `workspaces` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`timezone` text NOT NULL,
	`autotask_company_id` text,
	`status` text DEFAULT 'active' NOT NULL,
	`variables` text DEFAULT '{}' NOT NULL,
	`seed_tag` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	CONSTRAINT "status_check" CHECK("status" IN ('active', 'archived'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `workspaces_slug_idx` ON `workspaces` (`slug`);--> statement-breakpoint
CREATE INDEX `workspaces_status_idx` ON `workspaces` (`status`);--> statement-breakpoint
CREATE INDEX `workspaces_seed_tag_idx` ON `workspaces` (`seed_tag`) WHERE "workspaces"."seed_tag" IS NOT NULL;