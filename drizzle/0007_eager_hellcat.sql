ALTER TABLE `customers` ADD `seed_tag` text;--> statement-breakpoint
CREATE INDEX `customers_seed_tag_idx` ON `customers` (`seed_tag`) WHERE "customers"."seed_tag" IS NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `seed_tag` text;--> statement-breakpoint
CREATE INDEX `users_seed_tag_idx` ON `users` (`seed_tag`) WHERE "users"."seed_tag" IS NOT NULL;