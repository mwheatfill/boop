-- Drop the CHECK constraints on the growing config enums (channels.kind,
-- alert_rules.kind, job_templates.trigger_kind, jobs.trigger_kind) so future
-- enum values no longer force a SQLite table rebuild. SQLite cannot ALTER a
-- CHECK in place, so each table is recreated; all OTHER CHECKs are preserved.
-- Three tables have no FK children and rebuild in place. Rebuilding `jobs`
-- cascade-deletes its children (runs, attempts, alert_rules, webhook_secrets)
-- and on D1 no pragma suppresses that cascade, so the config children
-- (alert_rules, webhook_secrets) are snapshotted and restored; run history
-- (runs, attempts) is allowed to drop.
PRAGMA defer_foreign_keys=true;--> statement-breakpoint
CREATE TABLE `__new_alert_rules` (
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
	CONSTRAINT "alert_rules_scope_owner_check" CHECK(("__new_alert_rules"."scope" = 'workspace' AND "__new_alert_rules"."workspace_id" IS NOT NULL AND "__new_alert_rules"."job_id" IS NULL)
        OR ("__new_alert_rules"."scope" = 'job' AND "__new_alert_rules"."job_id" IS NOT NULL AND "__new_alert_rules"."workspace_id" IS NULL)),
	CONSTRAINT "status_check" CHECK("status" IN ('active', 'archived')),
	CONSTRAINT "scope_check" CHECK("scope" IN ('workspace', 'job'))
);
--> statement-breakpoint
INSERT INTO `__new_alert_rules`("id", "scope", "workspace_id", "job_id", "kind", "name", "slug", "config", "channel_ids", "status", "last_fired_at", "created_at", "updated_at") SELECT "id", "scope", "workspace_id", "job_id", "kind", "name", "slug", "config", "channel_ids", "status", "last_fired_at", "created_at", "updated_at" FROM `alert_rules`;--> statement-breakpoint
DROP TABLE `alert_rules`;--> statement-breakpoint
ALTER TABLE `__new_alert_rules` RENAME TO `alert_rules`;--> statement-breakpoint
CREATE UNIQUE INDEX `alert_rules_workspace_slug_idx` ON `alert_rules` (`workspace_id`,`slug`) WHERE "alert_rules"."scope" = 'workspace';--> statement-breakpoint
CREATE UNIQUE INDEX `alert_rules_job_slug_idx` ON `alert_rules` (`job_id`,`slug`) WHERE "alert_rules"."scope" = 'job';--> statement-breakpoint
CREATE INDEX `alert_rules_workspace_status_idx` ON `alert_rules` (`workspace_id`,`status`);--> statement-breakpoint
CREATE INDEX `alert_rules_job_idx` ON `alert_rules` (`job_id`);--> statement-breakpoint
CREATE INDEX `alert_rules_scope_status_idx` ON `alert_rules` (`scope`,`status`);--> statement-breakpoint
CREATE TABLE `__new_channels` (
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
	CONSTRAINT "status_check" CHECK("status" IN ('active', 'archived'))
);
--> statement-breakpoint
INSERT INTO `__new_channels`("id", "workspace_id", "kind", "name", "slug", "config", "status", "last_used_at", "last_test_alert_at", "last_test_alert_status", "last_test_alert_reason", "created_at", "updated_at") SELECT "id", "workspace_id", "kind", "name", "slug", "config", "status", "last_used_at", "last_test_alert_at", "last_test_alert_status", "last_test_alert_reason", "created_at", "updated_at" FROM `channels`;--> statement-breakpoint
DROP TABLE `channels`;--> statement-breakpoint
ALTER TABLE `__new_channels` RENAME TO `channels`;--> statement-breakpoint
CREATE UNIQUE INDEX `channels_workspace_slug_idx` ON `channels` (`workspace_id`,`slug`);--> statement-breakpoint
CREATE INDEX `channels_workspace_status_idx` ON `channels` (`workspace_id`,`status`);--> statement-breakpoint
CREATE TABLE `__new_job_templates` (
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
	CONSTRAINT "job_templates_builtin_owner_check" CHECK(("__new_job_templates"."built_in" = 1 AND "__new_job_templates"."workspace_id" IS NULL)
        OR ("__new_job_templates"."built_in" = 0 AND "__new_job_templates"."workspace_id" IS NOT NULL)),
	CONSTRAINT "status_check" CHECK("status" IN ('active', 'archived')),
	CONSTRAINT "tag_check" CHECK("tag" IN ('backups', 'health-checks', 'reports', 'integrations', 'maintenance', 'custom'))
);
--> statement-breakpoint
INSERT INTO `__new_job_templates`("id", "name", "slug", "workspace_id", "tag", "icon", "description", "trigger_kind", "trigger_config", "target_ref", "body_template", "headers_template", "variables", "max_attempts", "overall_deadline_ms", "built_in", "status", "archived_at", "created_at", "updated_at") SELECT "id", "name", "slug", "workspace_id", "tag", "icon", "description", "trigger_kind", "trigger_config", "target_ref", "body_template", "headers_template", "variables", "max_attempts", "overall_deadline_ms", "built_in", "status", "archived_at", "created_at", "updated_at" FROM `job_templates`;--> statement-breakpoint
DROP TABLE `job_templates`;--> statement-breakpoint
ALTER TABLE `__new_job_templates` RENAME TO `job_templates`;--> statement-breakpoint
CREATE UNIQUE INDEX `job_templates_builtin_slug_idx` ON `job_templates` (`slug`) WHERE "job_templates"."workspace_id" IS NULL AND "job_templates"."status" = 'active';--> statement-breakpoint
CREATE UNIQUE INDEX `job_templates_workspace_slug_idx` ON `job_templates` (`workspace_id`,`slug`) WHERE "job_templates"."workspace_id" IS NOT NULL AND "job_templates"."status" = 'active';--> statement-breakpoint
CREATE INDEX `job_templates_tag_idx` ON `job_templates` (`tag`) WHERE "job_templates"."status" = 'active';--> statement-breakpoint
CREATE INDEX `job_templates_workspace_status_idx` ON `job_templates` (`workspace_id`,`status`);--> statement-breakpoint
CREATE TABLE `_save_alert_rules` AS SELECT * FROM `alert_rules`;--> statement-breakpoint
CREATE TABLE `_save_webhook_secrets` AS SELECT * FROM `webhook_secrets`;--> statement-breakpoint
CREATE TABLE `__new_jobs` (
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
	CONSTRAINT "status_check" CHECK("status" IN ('active', 'paused', 'archived'))
);
--> statement-breakpoint
INSERT INTO `__new_jobs`("id", "workspace_id", "target_id", "name", "slug", "trigger_kind", "cron_expression", "interval_seconds", "trigger_timezone", "body_template", "headers_template", "variables", "last_fire_at", "last_missed_alert_at", "next_fire_at", "fire_in_progress", "max_attempts", "overall_deadline_ms", "status", "created_at", "updated_at") SELECT "id", "workspace_id", "target_id", "name", "slug", "trigger_kind", "cron_expression", "interval_seconds", "trigger_timezone", "body_template", "headers_template", "variables", "last_fire_at", "last_missed_alert_at", "next_fire_at", "fire_in_progress", "max_attempts", "overall_deadline_ms", "status", "created_at", "updated_at" FROM `jobs`;--> statement-breakpoint
DROP TABLE `jobs`;--> statement-breakpoint
ALTER TABLE `__new_jobs` RENAME TO `jobs`;--> statement-breakpoint
CREATE UNIQUE INDEX `jobs_workspace_slug_idx` ON `jobs` (`workspace_id`,`slug`);--> statement-breakpoint
CREATE INDEX `jobs_workspace_status_idx` ON `jobs` (`workspace_id`,`status`);--> statement-breakpoint
CREATE INDEX `jobs_status_next_fire_idx` ON `jobs` (`status`,`next_fire_at`);--> statement-breakpoint
CREATE INDEX `jobs_target_idx` ON `jobs` (`target_id`);--> statement-breakpoint
DELETE FROM `alert_rules`;--> statement-breakpoint
INSERT INTO `alert_rules` SELECT * FROM `_save_alert_rules`;--> statement-breakpoint
DELETE FROM `webhook_secrets`;--> statement-breakpoint
INSERT INTO `webhook_secrets` SELECT * FROM `_save_webhook_secrets`;--> statement-breakpoint
DROP TABLE `_save_alert_rules`;--> statement-breakpoint
DROP TABLE `_save_webhook_secrets`;
