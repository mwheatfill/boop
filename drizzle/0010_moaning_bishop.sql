CREATE TABLE `job_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`scope` text NOT NULL,
	`customer_id` text,
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
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "job_templates_scope_customer_id_check" CHECK(("job_templates"."scope" = 'workspace' AND "job_templates"."customer_id" IS NULL)
        OR ("job_templates"."scope" = 'customer' AND "job_templates"."customer_id" IS NOT NULL)),
	CONSTRAINT "status_check" CHECK("status" IN ('active', 'archived')),
	CONSTRAINT "scope_check" CHECK("scope" IN ('workspace', 'customer')),
	CONSTRAINT "tag_check" CHECK("tag" IN ('backups', 'health-checks', 'reports', 'integrations', 'maintenance', 'custom')),
	CONSTRAINT "trigger_kind_check" CHECK("trigger_kind" IN ('cron', 'interval', 'webhook'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `job_templates_workspace_slug_idx` ON `job_templates` (`slug`) WHERE "job_templates"."scope" = 'workspace' AND "job_templates"."status" = 'active';--> statement-breakpoint
CREATE UNIQUE INDEX `job_templates_customer_slug_idx` ON `job_templates` (`customer_id`,`slug`) WHERE "job_templates"."scope" = 'customer' AND "job_templates"."status" = 'active';--> statement-breakpoint
CREATE INDEX `job_templates_tag_idx` ON `job_templates` (`tag`) WHERE "job_templates"."status" = 'active';--> statement-breakpoint
CREATE INDEX `job_templates_scope_status_idx` ON `job_templates` (`scope`,`status`);