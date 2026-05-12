CREATE TABLE `alert_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_id` text NOT NULL,
	`job_id` text,
	`kind` text NOT NULL,
	`config` text DEFAULT '{}' NOT NULL,
	`channel_ids` text DEFAULT '[]' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "status_check" CHECK("status" IN ('active', 'archived')),
	CONSTRAINT "kind_check" CHECK("kind" IN ('first_failure', 'consecutive_failures', 'recovery', 'slow_run'))
);
--> statement-breakpoint
CREATE INDEX `alert_rules_customer_status_idx` ON `alert_rules` (`customer_id`,`status`);--> statement-breakpoint
CREATE INDEX `alert_rules_job_idx` ON `alert_rules` (`job_id`);--> statement-breakpoint
CREATE TABLE `attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`attempt_number` integer NOT NULL,
	`started_at` integer NOT NULL,
	`completed_at` integer,
	`http_status` integer,
	`failure_kind` text,
	`response_body_r2_key` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `runs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `attempts_run_idx` ON `attempts` (`run_id`,`attempt_number`);--> statement-breakpoint
CREATE TABLE `authoring_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`customer_id` text,
	`messages` text DEFAULT '[]' NOT NULL,
	`state` text DEFAULT 'draft' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "state_check" CHECK("state" IN ('draft', 'confirmed', 'abandoned'))
);
--> statement-breakpoint
CREATE INDEX `authoring_sessions_user_state_idx` ON `authoring_sessions` (`user_id`,`state`);--> statement-breakpoint
CREATE TABLE `channels` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_id` text NOT NULL,
	`kind` text NOT NULL,
	`name` text NOT NULL,
	`config` text DEFAULT '{}' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "status_check" CHECK("status" IN ('active', 'archived')),
	CONSTRAINT "kind_check" CHECK("kind" IN ('teams', 'pagerduty', 'autotask', 'email', 'webhook'))
);
--> statement-breakpoint
CREATE INDEX `channels_customer_status_idx` ON `channels` (`customer_id`,`status`);--> statement-breakpoint
CREATE TABLE `customers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`timezone` text NOT NULL,
	`autotask_company_id` text,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	CONSTRAINT "status_check" CHECK("status" IN ('active', 'archived'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `customers_slug_idx` ON `customers` (`slug`);--> statement-breakpoint
CREATE INDEX `customers_status_idx` ON `customers` (`status`);--> statement-breakpoint
CREATE TABLE `jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_id` text NOT NULL,
	`target_id` text NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`trigger_kind` text NOT NULL,
	`cron_expression` text,
	`interval_seconds` integer,
	`trigger_timezone` text,
	`body_template` text DEFAULT '' NOT NULL,
	`headers_template` text DEFAULT '{}' NOT NULL,
	`last_fire_at` integer,
	`next_fire_at` integer,
	`fire_in_progress` integer DEFAULT false NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`target_id`) REFERENCES `targets`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "status_check" CHECK("status" IN ('active', 'paused', 'archived')),
	CONSTRAINT "trigger_kind_check" CHECK("trigger_kind" IN ('cron', 'interval', 'webhook'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `jobs_customer_slug_idx` ON `jobs` (`customer_id`,`slug`);--> statement-breakpoint
CREATE INDEX `jobs_customer_status_idx` ON `jobs` (`customer_id`,`status`);--> statement-breakpoint
CREATE INDEX `jobs_status_next_fire_idx` ON `jobs` (`status`,`next_fire_at`);--> statement-breakpoint
CREATE TABLE `runs` (
	`id` text PRIMARY KEY NOT NULL,
	`job_id` text NOT NULL,
	`customer_id` text NOT NULL,
	`scheduled_at` integer NOT NULL,
	`started_at` integer,
	`completed_at` integer,
	`status` text DEFAULT 'scheduled' NOT NULL,
	`outcome` text,
	`skipped_reason` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `runs_job_started_idx` ON `runs` (`job_id`,"started_at" desc);--> statement-breakpoint
CREATE INDEX `runs_customer_started_idx` ON `runs` (`customer_id`,"started_at" desc);--> statement-breakpoint
CREATE TABLE `targets` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_id` text NOT NULL,
	`name` text NOT NULL,
	`url` text NOT NULL,
	`method` text NOT NULL,
	`auth_kind` text DEFAULT 'none' NOT NULL,
	`auth_config` text,
	`reachability` text DEFAULT 'public' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "status_check" CHECK("status" IN ('active', 'archived')),
	CONSTRAINT "reachability_check" CHECK("reachability" IN ('public', 'tunnel')),
	CONSTRAINT "auth_kind_check" CHECK("auth_kind" IN ('none', 'bearer', 'basic', 'header'))
);
--> statement-breakpoint
CREATE INDEX `targets_customer_status_idx` ON `targets` (`customer_id`,`status`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text,
	`image` text,
	`role` text DEFAULT 'operator' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	CONSTRAINT "role_check" CHECK("role" IN ('admin', 'operator'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_idx` ON `users` (`email`);