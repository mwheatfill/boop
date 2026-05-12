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
CREATE INDEX `webhook_secrets_job_active_idx` ON `webhook_secrets` (`job_id`,`revoked_at`);