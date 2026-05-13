PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_alert_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`scope` text DEFAULT 'customer' NOT NULL,
	`customer_id` text,
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
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "alert_rules_scope_owner_check" CHECK(("__new_alert_rules"."scope" = 'workspace' AND "__new_alert_rules"."customer_id" IS NULL AND "__new_alert_rules"."job_id" IS NULL)
        OR ("__new_alert_rules"."scope" = 'customer' AND "__new_alert_rules"."customer_id" IS NOT NULL AND "__new_alert_rules"."job_id" IS NULL)
        OR ("__new_alert_rules"."scope" = 'job' AND "__new_alert_rules"."customer_id" IS NOT NULL AND "__new_alert_rules"."job_id" IS NOT NULL)),
	CONSTRAINT "status_check" CHECK("status" IN ('active', 'archived')),
	CONSTRAINT "kind_check" CHECK("kind" IN ('first_failure', 'consecutive_failures', 'recovery', 'slow_run')),
	CONSTRAINT "scope_check" CHECK("scope" IN ('workspace', 'customer', 'job'))
);
--> statement-breakpoint
INSERT INTO `__new_alert_rules`("id", "scope", "customer_id", "job_id", "kind", "name", "slug", "config", "channel_ids", "status", "last_fired_at", "created_at", "updated_at") SELECT "id", CASE WHEN "job_id" IS NOT NULL THEN 'job' ELSE 'customer' END, "customer_id", "job_id", "kind", "name", "slug", "config", "channel_ids", "status", "last_fired_at", "created_at", "updated_at" FROM `alert_rules`;--> statement-breakpoint
DROP TABLE `alert_rules`;--> statement-breakpoint
ALTER TABLE `__new_alert_rules` RENAME TO `alert_rules`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `alert_rules_workspace_slug_idx` ON `alert_rules` (`slug`) WHERE "alert_rules"."scope" = 'workspace';--> statement-breakpoint
CREATE UNIQUE INDEX `alert_rules_customer_slug_idx` ON `alert_rules` (`customer_id`,`slug`) WHERE "alert_rules"."scope" = 'customer';--> statement-breakpoint
CREATE UNIQUE INDEX `alert_rules_job_slug_idx` ON `alert_rules` (`job_id`,`slug`) WHERE "alert_rules"."scope" = 'job';--> statement-breakpoint
CREATE INDEX `alert_rules_customer_status_idx` ON `alert_rules` (`customer_id`,`status`);--> statement-breakpoint
CREATE INDEX `alert_rules_job_idx` ON `alert_rules` (`job_id`);--> statement-breakpoint
CREATE INDEX `alert_rules_scope_status_idx` ON `alert_rules` (`scope`,`status`);--> statement-breakpoint
CREATE TABLE `__new_channels` (
	`id` text PRIMARY KEY NOT NULL,
	`scope` text DEFAULT 'customer' NOT NULL,
	`customer_id` text,
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
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "channels_scope_customer_id_check" CHECK(("__new_channels"."scope" = 'workspace' AND "__new_channels"."customer_id" IS NULL)
        OR ("__new_channels"."scope" = 'customer' AND "__new_channels"."customer_id" IS NOT NULL)),
	CONSTRAINT "status_check" CHECK("status" IN ('active', 'archived')),
	CONSTRAINT "kind_check" CHECK("kind" IN ('teams', 'pagerduty', 'autotask', 'email', 'webhook')),
	CONSTRAINT "scope_check" CHECK("scope" IN ('workspace', 'customer'))
);
--> statement-breakpoint
INSERT INTO `__new_channels`("id", "scope", "customer_id", "kind", "name", "slug", "config", "status", "last_used_at", "last_test_alert_at", "last_test_alert_status", "last_test_alert_reason", "created_at", "updated_at") SELECT "id", 'customer', "customer_id", "kind", "name", "slug", "config", "status", "last_used_at", "last_test_alert_at", "last_test_alert_status", "last_test_alert_reason", "created_at", "updated_at" FROM `channels`;--> statement-breakpoint
DROP TABLE `channels`;--> statement-breakpoint
ALTER TABLE `__new_channels` RENAME TO `channels`;--> statement-breakpoint
CREATE UNIQUE INDEX `channels_workspace_slug_idx` ON `channels` (`slug`) WHERE "channels"."scope" = 'workspace';--> statement-breakpoint
CREATE UNIQUE INDEX `channels_customer_slug_idx` ON `channels` (`customer_id`,`slug`) WHERE "channels"."scope" = 'customer';--> statement-breakpoint
CREATE INDEX `channels_customer_status_idx` ON `channels` (`customer_id`,`status`);--> statement-breakpoint
CREATE INDEX `channels_scope_status_idx` ON `channels` (`scope`,`status`);