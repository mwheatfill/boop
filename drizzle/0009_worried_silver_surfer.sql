CREATE TABLE `customer_secrets` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_id` text NOT NULL,
	`name` text NOT NULL,
	`value_hash` text NOT NULL,
	`value_ciphertext` text NOT NULL,
	`value_iv` text NOT NULL,
	`revoked_at` integer,
	`last_used_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `customer_secrets_active_name_idx` ON `customer_secrets` (`customer_id`,`name`) WHERE "customer_secrets"."revoked_at" IS NULL;--> statement-breakpoint
CREATE INDEX `customer_secrets_customer_idx` ON `customer_secrets` (`customer_id`);--> statement-breakpoint
ALTER TABLE `customers` ADD `variables` text DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE `jobs` ADD `variables` text DEFAULT '{}' NOT NULL;