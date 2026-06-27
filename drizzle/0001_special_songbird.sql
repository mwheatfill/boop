CREATE TABLE `tunnels` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`hostname` text NOT NULL,
	`internal_origin` text NOT NULL,
	`cf_tunnel_id` text NOT NULL,
	`cf_access_app_id` text NOT NULL,
	`cf_access_policy_id` text NOT NULL,
	`cf_service_token_id` text NOT NULL,
	`cf_dns_record_id` text,
	`client_id_secret_name` text NOT NULL,
	`client_secret_secret_name` text NOT NULL,
	`connector_status` text,
	`connector_checked_at` integer,
	`last_verify_outcome` text,
	`last_verified_at` integer,
	`status` text DEFAULT 'active' NOT NULL,
	`archived_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "status_check" CHECK("status" IN ('active', 'archived')),
	CONSTRAINT "connector_status_check" CHECK("connector_status" IN ('healthy', 'degraded', 'down', 'inactive')),
	CONSTRAINT "last_verify_outcome_check" CHECK("last_verify_outcome" IN ('ok', 'unauthorized', 'forbidden', 'network', 'unknown'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tunnels_workspace_slug_idx` ON `tunnels` (`workspace_id`,`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `tunnels_hostname_idx` ON `tunnels` (`hostname`);--> statement-breakpoint
CREATE UNIQUE INDEX `tunnels_cf_tunnel_id_idx` ON `tunnels` (`cf_tunnel_id`);--> statement-breakpoint
CREATE INDEX `tunnels_workspace_status_idx` ON `tunnels` (`workspace_id`,`status`);--> statement-breakpoint
ALTER TABLE `targets` ADD `tunnel_id` text REFERENCES tunnels(id) ON DELETE RESTRICT;