ALTER TABLE `alert_rules` ADD `name` text NOT NULL;--> statement-breakpoint
ALTER TABLE `alert_rules` ADD `slug` text NOT NULL;--> statement-breakpoint
ALTER TABLE `alert_rules` ADD `last_fired_at` integer;--> statement-breakpoint
CREATE UNIQUE INDEX `alert_rules_customer_slug_idx` ON `alert_rules` (`customer_id`,`slug`);--> statement-breakpoint
ALTER TABLE `channels` ADD `slug` text NOT NULL;--> statement-breakpoint
ALTER TABLE `channels` ADD `last_used_at` integer;--> statement-breakpoint
ALTER TABLE `channels` ADD `last_test_alert_at` integer;--> statement-breakpoint
ALTER TABLE `channels` ADD `last_test_alert_status` text;--> statement-breakpoint
ALTER TABLE `channels` ADD `last_test_alert_reason` text;--> statement-breakpoint
CREATE UNIQUE INDEX `channels_customer_slug_idx` ON `channels` (`customer_id`,`slug`);