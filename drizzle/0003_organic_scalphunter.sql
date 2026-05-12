ALTER TABLE `targets` ADD `slug` text NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `targets_customer_slug_idx` ON `targets` (`customer_id`,`slug`);