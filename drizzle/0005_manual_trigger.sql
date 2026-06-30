-- Widen trigger_kind CHECK to allow 'manual' on jobs + job_templates.
-- SQLite can't ALTER a CHECK in place, so the tables are recreated. DROP TABLE jobs
-- cascade-deletes its children (runs, attempts, alert_rules, webhook_secrets), and on
-- D1 neither foreign_keys=OFF nor defer_foreign_keys suppresses that cascade. So we
-- snapshot the config children (alert_rules, webhook_secrets) and restore them; run
-- history (runs, attempts) is allowed to drop.
PRAGMA defer_foreign_keys=true;
--> statement-breakpoint
CREATE TABLE `_save_alert_rules` AS SELECT * FROM `alert_rules`;
--> statement-breakpoint
CREATE TABLE `_save_webhook_secrets` AS SELECT * FROM `webhook_secrets`;
--> statement-breakpoint
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
	CONSTRAINT "status_check" CHECK("status" IN ('active', 'paused', 'archived')),
	CONSTRAINT "trigger_kind_check" CHECK("trigger_kind" IN ('cron', 'interval', 'webhook', 'manual'))
);
--> statement-breakpoint
INSERT INTO `__new_jobs` SELECT * FROM `jobs`;
--> statement-breakpoint
DROP TABLE `jobs`;
--> statement-breakpoint
ALTER TABLE `__new_jobs` RENAME TO `jobs`;
--> statement-breakpoint
CREATE UNIQUE INDEX `jobs_workspace_slug_idx` ON `jobs` (`workspace_id`,`slug`);
--> statement-breakpoint
CREATE INDEX `jobs_workspace_status_idx` ON `jobs` (`workspace_id`,`status`);
--> statement-breakpoint
CREATE INDEX `jobs_status_next_fire_idx` ON `jobs` (`status`,`next_fire_at`);
--> statement-breakpoint
DELETE FROM `alert_rules`;
--> statement-breakpoint
INSERT INTO `alert_rules` SELECT * FROM `_save_alert_rules`;
--> statement-breakpoint
DELETE FROM `webhook_secrets`;
--> statement-breakpoint
INSERT INTO `webhook_secrets` SELECT * FROM `_save_webhook_secrets`;
--> statement-breakpoint
DROP TABLE `_save_alert_rules`;
--> statement-breakpoint
DROP TABLE `_save_webhook_secrets`;
--> statement-breakpoint
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
	CONSTRAINT "job_templates_builtin_owner_check" CHECK(("built_in" = 1 AND "workspace_id" IS NULL)
        OR ("built_in" = 0 AND "workspace_id" IS NOT NULL)),
	CONSTRAINT "status_check" CHECK("status" IN ('active', 'archived')),
	CONSTRAINT "tag_check" CHECK("tag" IN ('backups', 'health-checks', 'reports', 'integrations', 'maintenance', 'custom')),
	CONSTRAINT "trigger_kind_check" CHECK("trigger_kind" IN ('cron', 'interval', 'webhook', 'manual'))
);
--> statement-breakpoint
INSERT INTO `__new_job_templates` SELECT * FROM `job_templates`;
--> statement-breakpoint
DROP TABLE `job_templates`;
--> statement-breakpoint
ALTER TABLE `__new_job_templates` RENAME TO `job_templates`;
--> statement-breakpoint
CREATE UNIQUE INDEX `job_templates_builtin_slug_idx` ON `job_templates` (`slug`) WHERE "job_templates"."workspace_id" IS NULL AND "job_templates"."status" = 'active';
--> statement-breakpoint
CREATE UNIQUE INDEX `job_templates_workspace_slug_idx` ON `job_templates` (`workspace_id`,`slug`) WHERE "job_templates"."workspace_id" IS NOT NULL AND "job_templates"."status" = 'active';
--> statement-breakpoint
CREATE INDEX `job_templates_tag_idx` ON `job_templates` (`tag`) WHERE "job_templates"."status" = 'active';
--> statement-breakpoint
CREATE INDEX `job_templates_workspace_status_idx` ON `job_templates` (`workspace_id`,`status`);
